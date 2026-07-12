// Reshape a PlanAnalysis into a single UNION of before + after nodes and edges so
// the React Flow view can keep instances stable across the before/after toggle and
// animate the diff. Pure; reshapes engine output only (no graph/diff logic here).

import type { GraphEdge, GraphNode, PlanAnalysis } from "../src/graph/types.js";
import { attackPathHighlights, edgeKey, type Highlights } from "./viewModel.js";
import { layoutGraph, reachableNodeIds, type NodePosition } from "./layout.js";

export interface CombinedNode {
  id: string;
  kind: GraphNode["kind"];
  label: string;
  isDataStore: boolean;
  inBefore: boolean;
  inAfter: boolean;
  posBefore: NodePosition;
  posAfter: NodePosition;
}

export interface CombinedEdge {
  from: string;
  to: string;
  reason: GraphEdge["reason"];
  detail: string | null;
  /** Undirected-highlight key ("from->to"), matches viewModel highlight sets. */
  key: string;
  /** Stable React Flow id, reason-qualified so parallel edges never collide. */
  id: string;
  inBefore: boolean;
  inAfter: boolean;
}

export interface CombinedView {
  nodes: CombinedNode[];
  edges: CombinedEdge[];
  /** Nodes/edges on newly opened (added) attack paths. */
  added: Highlights;
  /** Nodes/edges on closed (removed) attack paths. */
  removed: Highlights;
  /** Attack-path highlights for each side (the current red paths). */
  before: Highlights;
  after: Highlights;
  /** Node ids reachable from INTERNET in each side (for isolated-lane labelling). */
  reachableBefore: Set<string>;
  reachableAfter: Set<string>;
}

type Side = "before" | "after";

interface NodeAcc {
  kind: GraphNode["kind"];
  label: string;
  isDataStore: boolean;
  inBefore: boolean;
  inAfter: boolean;
}

export function buildCombinedView(analysis: PlanAnalysis): CombinedView {
  const beforeGraph = analysis.before.graph;
  const afterGraph = analysis.after.graph;

  const nodeAcc = new Map<string, NodeAcc>();
  const markNodes = (nodes: GraphNode[], side: Side) => {
    for (const n of nodes) {
      const existing = nodeAcc.get(n.id);
      if (existing) {
        if (side === "before") existing.inBefore = true;
        else existing.inAfter = true;
      } else {
        nodeAcc.set(n.id, {
          kind: n.kind,
          label: n.label,
          isDataStore: n.isDataStore,
          inBefore: side === "before",
          inAfter: side === "after",
        });
      }
    }
  };
  markNodes(beforeGraph.nodes, "before");
  markNodes(afterGraph.nodes, "after");

  const layoutBefore = layoutGraph(beforeGraph);
  const layoutAfter = layoutGraph(afterGraph);
  const nodes: CombinedNode[] = [];
  for (const [id, acc] of nodeAcc) {
    const b = layoutBefore.get(id);
    const a = layoutAfter.get(id);
    nodes.push({
      id,
      kind: acc.kind,
      label: acc.label,
      isDataStore: acc.isDataStore,
      inBefore: acc.inBefore,
      inAfter: acc.inAfter,
      // A node absent from one side rests at its other-side position (fade in place).
      posBefore: b ?? a ?? { x: 0, y: 0 },
      posAfter: a ?? b ?? { x: 0, y: 0 },
    });
  }

  const edgeAcc = new Map<string, CombinedEdge>();
  const markEdges = (edges: GraphEdge[], side: Side) => {
    for (const e of edges) {
      const id = `${e.from}->${e.to}:${e.reason}`;
      const existing = edgeAcc.get(id);
      if (existing) {
        if (side === "before") existing.inBefore = true;
        else existing.inAfter = true;
      } else {
        edgeAcc.set(id, {
          from: e.from,
          to: e.to,
          reason: e.reason,
          detail: e.detail,
          key: edgeKey(e.from, e.to),
          id,
          inBefore: side === "before",
          inAfter: side === "after",
        });
      }
    }
  };
  markEdges(beforeGraph.edges, "before");
  markEdges(afterGraph.edges, "after");

  return {
    nodes,
    edges: [...edgeAcc.values()],
    added: attackPathHighlights(analysis.diff.added),
    removed: attackPathHighlights(analysis.diff.removed),
    before: attackPathHighlights(analysis.before.paths),
    after: attackPathHighlights(analysis.after.paths),
    reachableBefore: reachableNodeIds(beforeGraph),
    reachableAfter: reachableNodeIds(afterGraph),
  };
}
