import { describe, expect, it } from "vitest";

import type { AttackPath } from "../src/graph/types.js";
import { attackPathHighlights, edgeKey } from "./viewModel.js";

function path(nodes: string[]): AttackPath {
  return { nodes, dataStore: nodes[nodes.length - 1] as string, key: nodes.join(" -> ") };
}

describe("attackPathHighlights", () => {
  it("collects nodes and consecutive edges of a single path", () => {
    const { nodeIds, edgeKeys } = attackPathHighlights([path(["INTERNET", "sg", "db"])]);
    expect([...nodeIds].sort()).toEqual(["INTERNET", "db", "sg"]);
    expect([...edgeKeys].sort()).toEqual(["INTERNET->sg", "sg->db"]);
  });

  it("unions nodes and edges across multiple paths", () => {
    const { nodeIds, edgeKeys } = attackPathHighlights([
      path(["INTERNET", "sg", "db"]),
      path(["INTERNET", "s3"]),
    ]);
    expect(nodeIds.has("s3")).toBe(true);
    expect(edgeKeys.has("INTERNET->s3")).toBe(true);
    expect(edgeKeys.has("sg->db")).toBe(true);
  });

  it("returns empty sets for no paths", () => {
    const { nodeIds, edgeKeys } = attackPathHighlights([]);
    expect(nodeIds.size).toBe(0);
    expect(edgeKeys.size).toBe(0);
  });

  it("edgeKey is direction-sensitive", () => {
    expect(edgeKey("a", "b")).toBe("a->b");
    expect(edgeKey("a", "b")).not.toBe(edgeKey("b", "a"));
  });
});
