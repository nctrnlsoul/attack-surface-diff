// The parser entry points.
//
// Fail-closed contract: unparseable or unknown-shaped input produces a clear
// typed ParseError and NO partial result. A resource whose *type* is valid but
// not modeled is collected into `unmodeled`, never dropped and never an error.

import { extractorFor, isObject } from "./resources.js";
import type {
  ModeledResource,
  ParseError,
  ParseResult,
  ParsedPlan,
  ResourceSet,
  UnmodeledResource,
} from "./types.js";

/** Internal control-flow error used to unwind the walk to a typed ParseError. */
class ParseFailure extends Error {
  constructor(readonly parseError: ParseError) {
    super(parseError.message);
    this.name = "ParseFailure";
  }
}

function fail(code: ParseError["code"], message: string, path: string): never {
  throw new ParseFailure({ code, message, path });
}

/**
 * Parse a `terraform show -json` payload that has ALREADY been JSON-parsed into
 * a value. Returns a typed result. Never throws for expected bad input.
 */
export function parsePlan(input: unknown): ParseResult {
  try {
    if (!isObject(input)) {
      fail("NOT_AN_OBJECT", "Top-level plan JSON must be an object.", "(root)");
    }

    const hasPrior = input["prior_state"] !== undefined && input["prior_state"] !== null;
    const hasPlanned =
      input["planned_values"] !== undefined && input["planned_values"] !== null;

    if (!hasPrior && !hasPlanned) {
      fail(
        "MISSING_PLAN_STATES",
        "Plan JSON has neither `prior_state` nor `planned_values`. " +
          "Expected the output of `terraform show -json`.",
        "(root)",
      );
    }

    const before = hasPrior
      ? parsePriorState(input["prior_state"])
      : emptySet();
    const after = hasPlanned
      ? parsePlannedValues(input["planned_values"])
      : emptySet();

    const plan: ParsedPlan = {
      formatVersion: asStringOrNull(input["format_version"]),
      terraformVersion: asStringOrNull(input["terraform_version"]),
      before,
      after,
    };
    return { ok: true, plan };
  } catch (err) {
    if (err instanceof ParseFailure) {
      return { ok: false, error: err.parseError };
    }
    throw err;
  }
}

/**
 * Parse a raw `terraform show -json` string. Fails closed with INVALID_JSON if
 * the text is not valid JSON, otherwise delegates to `parsePlan`.
 */
export function parsePlanJson(text: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: {
        code: "INVALID_JSON",
        message: `Input is not valid JSON: ${detail}`,
        path: "(root)",
      },
    };
  }
  return parsePlan(parsed);
}

// --- state containers -------------------------------------------------------

/** `prior_state` is a full state file: resources live under `.values.root_module`. */
function parsePriorState(prior: unknown): ResourceSet {
  if (!isObject(prior)) {
    fail("MALFORMED_STATE", "`prior_state` must be an object.", "prior_state");
  }
  // A present-but-empty prior state (no `values`) is valid: nothing existed yet.
  const values = prior["values"];
  if (values === undefined || values === null) return emptySet();
  if (!isObject(values)) {
    fail("MALFORMED_STATE", "`prior_state.values` must be an object.", "prior_state.values");
  }
  return parseValuesContainer(values, "prior_state.values");
}

/** `planned_values` is a values representation: resources live under `.root_module`. */
function parsePlannedValues(planned: unknown): ResourceSet {
  if (!isObject(planned)) {
    fail("MALFORMED_STATE", "`planned_values` must be an object.", "planned_values");
  }
  return parseValuesContainer(planned, "planned_values");
}

/** Shared: a container holding a `root_module`. */
function parseValuesContainer(container: Record<string, unknown>, path: string): ResourceSet {
  const set = emptySet();
  const rootModule = container["root_module"];
  if (rootModule === undefined || rootModule === null) return set;
  if (!isObject(rootModule)) {
    fail("MALFORMED_STATE", "`root_module` must be an object.", `${path}.root_module`);
  }
  walkModule(rootModule, `${path}.root_module`, set);
  return set;
}

// --- module walk ------------------------------------------------------------

function walkModule(mod: Record<string, unknown>, path: string, set: ResourceSet): void {
  const resources = mod["resources"];
  if (resources !== undefined) {
    if (!Array.isArray(resources)) {
      fail("MALFORMED_STATE", "`resources` must be an array.", `${path}.resources`);
    }
    resources.forEach((entry, i) => {
      parseResourceEntry(entry, `${path}.resources[${i}]`, set);
    });
  }

  const childModules = mod["child_modules"];
  if (childModules !== undefined) {
    if (!Array.isArray(childModules)) {
      fail("MALFORMED_STATE", "`child_modules` must be an array.", `${path}.child_modules`);
    }
    childModules.forEach((child, i) => {
      const childPath = `${path}.child_modules[${i}]`;
      if (!isObject(child)) {
        fail("MALFORMED_STATE", "Each child module must be an object.", childPath);
      }
      walkModule(child, childPath, set);
    });
  }
}

function parseResourceEntry(entry: unknown, path: string, set: ResourceSet): void {
  if (!isObject(entry)) {
    fail("MALFORMED_RESOURCE", "Resource entry must be an object.", path);
  }

  const type = entry["type"];
  const address = entry["address"];
  const name = entry["name"];
  const values = entry["values"];

  if (typeof type !== "string") {
    fail("MALFORMED_RESOURCE", "Resource is missing a string `type`.", path);
  }
  if (typeof address !== "string") {
    fail("MALFORMED_RESOURCE", "Resource is missing a string `address`.", path);
  }
  if (typeof name !== "string") {
    fail("MALFORMED_RESOURCE", "Resource is missing a string `name`.", path);
  }
  if (!isObject(values)) {
    fail("MALFORMED_RESOURCE", "Resource is missing an object `values`.", path);
  }

  const provider = asStringOrNull(entry["provider_name"]);
  const base = { address, type, name, provider, raw: values };

  const extractor = extractorFor(type);
  if (extractor) {
    set.resources.push(extractor(base, values) as ModeledResource);
  } else {
    const unmodeled: UnmodeledResource = { address, type, name, raw: values };
    set.unmodeled.push(unmodeled);
  }
}

// --- small helpers ----------------------------------------------------------

function emptySet(): ResourceSet {
  return { resources: [], unmodeled: [] };
}

function asStringOrNull(x: unknown): string | null {
  return typeof x === "string" ? x : null;
}
