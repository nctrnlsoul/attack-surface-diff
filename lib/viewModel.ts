// Pure view helpers: derive which nodes and edges belong to an attack path so
// the graph can highlight them. No React, no engine mutation.

import type { AttackPath } from "../src/graph/types.js";

export interface Highlights {
  /** Node ids that lie on at least one attack path. */
  nodeIds: Set<string>;
  /** Directed edge keys ("from->to") that lie on at least one attack path. */
  edgeKeys: Set<string>;
}

/** Stable key for a directed edge, matching the graph's edge direction. */
export function edgeKey(from: string, to: string): string {
  return `${from}->${to}`;
}

/** Collect the nodes and consecutive-edge keys covered by the given paths. */
export function attackPathHighlights(paths: AttackPath[]): Highlights {
  const nodeIds = new Set<string>();
  const edgeKeys = new Set<string>();
  for (const path of paths) {
    for (let i = 0; i < path.nodes.length; i++) {
      const node = path.nodes[i];
      if (node === undefined) continue;
      nodeIds.add(node);
      const prev = i > 0 ? path.nodes[i - 1] : undefined;
      if (prev !== undefined) edgeKeys.add(edgeKey(prev, node));
    }
  }
  return { nodeIds, edgeKeys };
}
