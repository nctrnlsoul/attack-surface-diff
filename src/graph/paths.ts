// findAttackPaths + diffAttackPaths. Pure functions over an AttackGraph.

import { INTERNET, type AttackGraph, type AttackPath, type PathDiff } from "./types.js";

/** Default cap on path length (in nodes) to bound pathological graphs. */
export const DEFAULT_MAX_DEPTH = 8;

/**
 * Enumerate simple paths (no repeated node) from INTERNET to any data-store
 * node, bounded to `maxDepth` nodes. Deterministic: adjacency follows edge
 * insertion order, which buildGraph produces deterministically.
 */
export function findAttackPaths(
  graph: AttackGraph,
  maxDepth: number = DEFAULT_MAX_DEPTH,
): AttackPath[] {
  const adjacency = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const list = adjacency.get(edge.from) ?? [];
    list.push(edge.to);
    adjacency.set(edge.from, list);
  }

  const dataStores = new Set<string>();
  for (const node of graph.nodes) {
    if (node.isDataStore) dataStores.add(node.id);
  }

  const results: AttackPath[] = [];
  const pathNodes: string[] = [INTERNET];
  const visited = new Set<string>([INTERNET]);

  const dfs = (current: string): void => {
    // A data store reached via at least one hop is an attack path.
    if (dataStores.has(current) && pathNodes.length >= 2) {
      results.push({
        nodes: [...pathNodes],
        dataStore: current,
        key: pathNodes.join(" -> "),
      });
    }
    if (pathNodes.length >= maxDepth) return;
    for (const next of adjacency.get(current) ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      pathNodes.push(next);
      dfs(next);
      pathNodes.pop();
      visited.delete(next);
    }
  };

  dfs(INTERNET);
  return results;
}

/** Set difference of two path collections, keyed by path identity. */
export function diffAttackPaths(before: AttackPath[], after: AttackPath[]): PathDiff {
  const beforeByKey = new Map(before.map((p) => [p.key, p]));
  const afterByKey = new Map(after.map((p) => [p.key, p]));

  const added: AttackPath[] = [];
  const unchanged: AttackPath[] = [];
  for (const p of afterByKey.values()) {
    if (beforeByKey.has(p.key)) unchanged.push(p);
    else added.push(p);
  }

  const removed: AttackPath[] = [];
  for (const p of beforeByKey.values()) {
    if (!afterByKey.has(p.key)) removed.push(p);
  }

  return { added, removed, unchanged };
}
