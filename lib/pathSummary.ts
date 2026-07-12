// Turn a PlanAnalysis into minimal per-path summaries. This is the SOLE producer of
// the data that leaves the browser for the AI narrative — it carries resource
// addresses, types, and edge reasons/ports, and NOTHING from the plan file (no
// prior_state / planned_values / raw values). Pure; reuses engine output only.

import type { AttackGraph, AttackPath, GraphEdge, PlanAnalysis } from "../src/graph/types.js";
import { edgeKey } from "./viewModel.js";
import type { PathSummary } from "./narrative.js";

function summarizePath(path: AttackPath, graph: AttackGraph, kind: "added" | "removed"): PathSummary {
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const edgeByPair = new Map<string, GraphEdge>();
  for (const e of graph.edges) {
    const key = edgeKey(e.from, e.to);
    if (!edgeByPair.has(key)) edgeByPair.set(key, e); // first edge for the pair wins
  }

  const nodes: PathSummary["nodes"] = path.nodes.map((id) => {
    const node = nodeById.get(id);
    return { address: id, type: node ? node.kind : "unknown" };
  });

  const hops: PathSummary["hops"] = [];
  for (let i = 1; i < path.nodes.length; i++) {
    const from = path.nodes[i - 1];
    const to = path.nodes[i];
    if (from === undefined || to === undefined) continue;
    const edge = edgeByPair.get(edgeKey(from, to));
    hops.push({ reason: edge ? edge.reason : "unknown", detail: edge ? edge.detail : null });
  }

  return { kind, nodes, hops };
}

export function buildPathSummaries(analysis: PlanAnalysis): PathSummary[] {
  const summaries: PathSummary[] = [];
  for (const path of analysis.diff.added) {
    summaries.push(summarizePath(path, analysis.after.graph, "added"));
  }
  for (const path of analysis.diff.removed) {
    summaries.push(summarizePath(path, analysis.before.graph, "removed"));
  }
  return summaries;
}
