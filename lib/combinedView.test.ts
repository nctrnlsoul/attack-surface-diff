import { describe, expect, it } from "vitest";

import { parsePlan } from "../src/parser/parse.js";
import { analyzePlan } from "../src/graph/analyze.js";
import type { PlanAnalysis } from "../src/graph/types.js";
import { scenarioSgOpenedExposesRds } from "../src/graph/fixtures/scenarios.js";
import { buildCombinedView } from "./combinedView.js";

function analysisOf(planInput: unknown): PlanAnalysis {
  const result = parsePlan(planInput);
  if (!result.ok) throw new Error(`fixture failed to parse: ${result.error.message}`);
  return analyzePlan(result.plan);
}

// Scenario 1: web-sg opens to 0.0.0.0/0 in `after`, exposing RDS through db-sg.
const combined = () => buildCombinedView(analysisOf(scenarioSgOpenedExposesRds()));

describe("buildCombinedView", () => {
  it("unions nodes across both sides, each appearing once", () => {
    const view = combined();
    const ids = view.nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length); // no duplicates
    expect(ids).toContain("INTERNET");
    expect(ids).toContain("aws_security_group.web");
    expect(ids).toContain("aws_db_instance.prod");
  });

  it("marks nodes present in both sides as inBefore and inAfter", () => {
    const web = combined().nodes.find((n) => n.id === "aws_security_group.web");
    expect(web?.inBefore).toBe(true);
    expect(web?.inAfter).toBe(true);
  });

  it("flags the INTERNET->web-sg edge as after-only", () => {
    const edge = combined().edges.find(
      (e) => e.from === "INTERNET" && e.to === "aws_security_group.web",
    );
    expect(edge?.inAfter).toBe(true);
    expect(edge?.inBefore).toBe(false);
  });

  it("puts the new RDS path's edges in the added highlight set", () => {
    const view = combined();
    expect(view.added.edgeKeys.has("INTERNET->aws_security_group.web")).toBe(true);
    expect(view.added.edgeKeys.has("aws_security_group.db->aws_db_instance.prod")).toBe(true);
    expect(view.removed.edgeKeys.size).toBe(0);
  });

  it("reports RDS reachable only in the after state", () => {
    const view = combined();
    expect(view.reachableAfter.has("aws_db_instance.prod")).toBe(true);
    expect(view.reachableBefore.has("aws_db_instance.prod")).toBe(false);
  });

  it("assigns both before and after positions to every union node", () => {
    for (const n of combined().nodes) {
      expect(n.posBefore).toBeDefined();
      expect(n.posAfter).toBeDefined();
    }
  });
});
