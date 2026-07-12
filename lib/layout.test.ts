import { describe, expect, it } from "vitest";

import type { AttackGraph, GraphNode } from "../src/graph/types.js";
import { INTERNET } from "../src/graph/types.js";
import { COLUMN_GAP, ISOLATED_LANE_GAP, ROW_GAP, layoutGraph } from "./layout.js";

function node(id: string, isDataStore = false): GraphNode {
  return { id, kind: "vpc", label: id, isDataStore };
}

const internetNode: GraphNode = { id: INTERNET, kind: "internet", label: INTERNET, isDataStore: false };

describe("layoutGraph", () => {
  it("places INTERNET at the origin column", () => {
    const graph: AttackGraph = { nodes: [internetNode], edges: [] };
    expect(layoutGraph(graph).get(INTERNET)).toEqual({ x: 0, y: 0 });
  });

  it("places nodes in columns by BFS depth from INTERNET", () => {
    const graph: AttackGraph = {
      nodes: [internetNode, node("sg"), node("db", true)],
      edges: [
        { from: INTERNET, to: "sg", reason: "internet_ingress", detail: null },
        { from: "sg", to: "db", reason: "sg_membership", detail: null },
      ],
    };
    const layout = layoutGraph(graph);
    expect(layout.get("sg")?.x).toBe(COLUMN_GAP);
    expect(layout.get("db")?.x).toBe(2 * COLUMN_GAP);
  });

  it("stacks nodes at the same depth into separate rows", () => {
    const graph: AttackGraph = {
      nodes: [internetNode, node("a"), node("b")],
      edges: [
        { from: INTERNET, to: "a", reason: "internet_ingress", detail: null },
        { from: INTERNET, to: "b", reason: "internet_ingress", detail: null },
      ],
    };
    const layout = layoutGraph(graph);
    expect(layout.get("a")).toEqual({ x: COLUMN_GAP, y: 0 });
    expect(layout.get("b")).toEqual({ x: COLUMN_GAP, y: ROW_GAP });
  });

  it("drops nodes unreachable from INTERNET into a lane below the flow", () => {
    const graph: AttackGraph = {
      nodes: [internetNode, node("sg"), node("vpc")],
      edges: [{ from: INTERNET, to: "sg", reason: "internet_ingress", detail: null }],
    };
    const layout = layoutGraph(graph);
    // Tallest column has 1 row (INTERNET col and sg col each height 1).
    expect(layout.get("vpc")).toEqual({ x: 0, y: ROW_GAP + ISOLATED_LANE_GAP });
  });

  it("assigns a position to every node", () => {
    const graph: AttackGraph = {
      nodes: [internetNode, node("sg"), node("iam"), node("db", true)],
      edges: [
        { from: INTERNET, to: "sg", reason: "internet_ingress", detail: null },
        { from: "sg", to: "db", reason: "sg_membership", detail: null },
      ],
    };
    const layout = layoutGraph(graph);
    for (const n of graph.nodes) {
      expect(layout.has(n.id)).toBe(true);
    }
  });
});
