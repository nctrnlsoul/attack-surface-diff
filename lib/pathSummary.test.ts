import { describe, expect, it } from "vitest";

import { parsePlan } from "../src/parser/parse.js";
import { analyzePlan } from "../src/graph/analyze.js";
import type { PlanAnalysis } from "../src/graph/types.js";
import {
  scenarioFixClosesRdsPath,
  scenarioSgOpenedExposesRds,
} from "../src/graph/fixtures/scenarios.js";
import { buildPathSummaries } from "./pathSummary.js";

function analysisOf(planInput: unknown): PlanAnalysis {
  const result = parsePlan(planInput);
  if (!result.ok) throw new Error(`fixture failed to parse: ${result.error.message}`);
  return analyzePlan(result.plan);
}

describe("buildPathSummaries", () => {
  it("summarizes scenario 1 as one added path ending at RDS", () => {
    const summaries = buildPathSummaries(analysisOf(scenarioSgOpenedExposesRds()));
    expect(summaries).toHaveLength(1);
    const s = summaries[0];
    expect(s?.kind).toBe("added");
    expect(s?.nodes[0]?.address).toBe("INTERNET");
    const last = s?.nodes[s.nodes.length - 1];
    expect(last?.address).toBe("aws_db_instance.prod");
    expect(last?.type).toBe("db_instance");
    expect(s?.hops[0]?.reason).toBe("internet_ingress");
  });

  it("summarizes scenario 3 as one removed path ending at RDS", () => {
    const summaries = buildPathSummaries(analysisOf(scenarioFixClosesRdsPath()));
    expect(summaries).toHaveLength(1);
    expect(summaries[0]?.kind).toBe("removed");
    const nodes = summaries[0]?.nodes ?? [];
    expect(nodes[nodes.length - 1]?.address).toBe("aws_db_instance.prod");
  });

  it("carries only summary fields — no plan data, no raw values leave the browser", () => {
    const summaries = buildPathSummaries(analysisOf(scenarioSgOpenedExposesRds()));
    const serialized = JSON.stringify(summaries);
    // The plan file's structure and raw resource attributes must never appear.
    // (A generic CIDR like 0.0.0.0/0 in an edge detail is a public constant, not
    // user data, so it is intentionally NOT treated as sensitive.)
    for (const forbidden of [
      "prior_state",
      "planned_values",
      "\"raw\"",
      "publicly_accessible",
      "vpc_security_group_ids",
      "db_subnet_group_name",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
    // Positive: it does carry the modeled fields it should.
    expect(serialized).toContain("aws_db_instance.prod");
    expect(serialized).toContain("internet_ingress");
  });
});
