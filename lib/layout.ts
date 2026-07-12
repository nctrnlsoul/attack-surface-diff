// Pure, deterministic layered layout: assign each graph node an (x, y) so the
// attack flow reads left-to-right (INTERNET at column 0, deeper nodes further
// right). Nodes unreachable from INTERNET (VPC, IAM, subnets, etc.) drop into a
// single lane below the main flow. No force simulation yet — that is Week 2.

import type { AttackGraph } from "../src/graph/types.js";
import { INTERNET } from "../src/graph/types.js";

export interface NodePosition {
  x: number;
  y: number;
}

export type GraphLayout = Map<string, NodePosition>;

export const COLUMN_GAP = 240;
export const ROW_GAP = 96;
/** Vertical gap between the main flow and the isolated-node lane. */
export const ISOLATED_LANE_GAP = 80;

/** BFS depth from INTERNET over directed edges; unreachable nodes are absent. */
function depthFromInternet(graph: AttackGraph): Map<string, number> {
  const adjacency = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const list = adjacency.get(edge.from) ?? [];
    list.push(edge.to);
    adjacency.set(edge.from, list);
  }

  const depth = new Map<string, number>();
  const queue: string[] = [];
  if (graph.nodes.some((n) => n.id === INTERNET)) {
    depth.set(INTERNET, 0);
    queue.push(INTERNET);
  }

  let head = 0;
  while (head < queue.length) {
    const current = queue[head++];
    if (current === undefined) continue;
    const currentDepth = depth.get(current) ?? 0;
    for (const next of adjacency.get(current) ?? []) {
      if (!depth.has(next)) {
        depth.set(next, currentDepth + 1);
        queue.push(next);
      }
    }
  }
  return depth;
}

/** Node ids reachable from INTERNET over directed edges (the non-isolated set). */
export function reachableNodeIds(graph: AttackGraph): Set<string> {
  return new Set(depthFromInternet(graph).keys());
}

export function layoutGraph(graph: AttackGraph): GraphLayout {
  const depth = depthFromInternet(graph);
  const layout: GraphLayout = new Map();
  const rowInColumn = new Map<number, number>();
  const isolated: string[] = [];

  for (const node of graph.nodes) {
    const d = depth.get(node.id);
    if (d === undefined) {
      isolated.push(node.id);
      continue;
    }
    const row = rowInColumn.get(d) ?? 0;
    rowInColumn.set(d, row + 1);
    layout.set(node.id, { x: d * COLUMN_GAP, y: row * ROW_GAP });
  }

  // Isolated nodes get their own lane below the tallest column.
  const tallestColumn = Math.max(0, ...rowInColumn.values());
  const isolatedY = tallestColumn * ROW_GAP + ISOLATED_LANE_GAP;
  isolated.forEach((id, i) => {
    layout.set(id, { x: i * COLUMN_GAP, y: isolatedY });
  });

  return layout;
}
