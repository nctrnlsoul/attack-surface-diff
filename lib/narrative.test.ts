import { describe, expect, it } from "vitest";

import {
  NARRATIVE_SYSTEM,
  buildUserPayload,
  containsForbiddenClaim,
  type PathSummary,
} from "./narrative.js";

describe("NARRATIVE_SYSTEM", () => {
  it("frames output as declared reachability", () => {
    expect(NARRATIVE_SYSTEM.toLowerCase()).toContain("declared reachability");
  });

  it("does not contain the forbidden honest-claims phrases", () => {
    const lower = NARRATIVE_SYSTEM.toLowerCase();
    expect(lower).not.toContain("pentest");
    expect(lower).not.toContain("vulnerability scan");
    expect(lower).not.toContain("runtime security");
  });
});

describe("containsForbiddenClaim", () => {
  it("flags sentences that break the honest-claims rule", () => {
    expect(containsForbiddenClaim("This is a pentest finding.")).toBe(true);
    expect(containsForbiddenClaim("A vulnerability scan found this.")).toBe(true);
    expect(containsForbiddenClaim("A RUNTIME SECURITY issue.")).toBe(true);
  });

  it("passes an honest declared-reachability sentence", () => {
    expect(
      containsForbiddenClaim(
        "This change exposes RDS aws_db_instance.prod to the internet, as declared in the plan.",
      ),
    ).toBe(false);
  });
});

describe("buildUserPayload", () => {
  const summary: PathSummary = {
    kind: "added",
    nodes: [
      { address: "INTERNET", type: "internet" },
      { address: "aws_db_instance.prod", type: "db_instance" },
    ],
    hops: [{ reason: "internet_ingress", detail: "tcp 5432" }],
  };

  it("includes only the summary fields", () => {
    const payload = buildUserPayload([summary]);
    expect(payload).toContain("aws_db_instance.prod");
    expect(payload).toContain("internet_ingress");
    expect(payload).not.toContain("prior_state");
    expect(payload).not.toContain("planned_values");
  });
});
