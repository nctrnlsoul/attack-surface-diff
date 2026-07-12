// Shared test helpers for the graph suites (build.test.ts, paths.test.ts).

import { parsePlan } from "../../parser/parse.js";
import type { ResourceSet } from "../../parser/types.js";
import { planWithAfter } from "../../parser/fixtures/plans.js";
import { buildGraph } from "../build.js";
import type { AttackGraph, EdgeReason } from "../types.js";

/** Parse a resource list into the `after` ResourceSet for graph tests. */
export function setOf(resources: unknown[]): ResourceSet {
  const result = parsePlan(planWithAfter(resources));
  if (!result.ok) throw new Error(`fixture failed to parse: ${result.error.message}`);
  return result.plan.after;
}

/** Build a graph directly from a resource list. */
export function graphOf(resources: unknown[]): AttackGraph {
  return buildGraph(setOf(resources));
}

export function hasEdge(g: AttackGraph, from: string, to: string, reason: EdgeReason): boolean {
  return g.edges.some((e) => e.from === from && e.to === to && e.reason === reason);
}

export function edgesByReason(g: AttackGraph, reason: EdgeReason) {
  return g.edges.filter((e) => e.reason === reason);
}

/** An inline SG ingress block open to a single CIDR on one port. */
export function openIngress(cidr: string, port = 443) {
  return {
    from_port: port,
    to_port: port,
    protocol: "tcp",
    cidr_blocks: [cidr],
    ipv6_cidr_blocks: [] as string[],
    security_groups: [] as string[],
    self: false,
  };
}
