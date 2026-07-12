// analyzePlan: the single entry point tying the parser output to the graph
// engine. Given a ParsedPlan, build both sides' graphs, find their attack paths,
// and diff them. Pure function; this is what the viz slice will call.

import type { ParsedPlan, ResourceSet } from "../parser/types.js";
import { buildGraph } from "./build.js";
import { diffAttackPaths, findAttackPaths } from "./paths.js";
import type { PlanAnalysis, SideAnalysis } from "./types.js";

function analyzeSide(set: ResourceSet, maxDepth: number | undefined): SideAnalysis {
  const graph = buildGraph(set);
  // Passing `undefined` lets findAttackPaths apply its own DEFAULT_MAX_DEPTH.
  const paths = findAttackPaths(graph, maxDepth);
  return { graph, paths };
}

export function analyzePlan(plan: ParsedPlan, maxDepth?: number): PlanAnalysis {
  const before = analyzeSide(plan.before, maxDepth);
  const after = analyzeSide(plan.after, maxDepth);
  const diff = diffAttackPaths(before.paths, after.paths);
  return { before, after, diff };
}
