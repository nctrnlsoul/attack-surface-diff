import { describe, expect, it } from "vitest";

import { parsePlan } from "../src/parser/parse.js";
import type { ResourceSet } from "../src/parser/types.js";
import { planWithAfter, resource } from "../src/parser/fixtures/plans.js";
import { associationEdges } from "./associations.js";

function setOf(resources: unknown[]): ResourceSet {
  const result = parsePlan(planWithAfter(resources));
  if (!result.ok) throw new Error(`fixture failed to parse: ${result.error.message}`);
  return result.plan.after;
}

const bucket = (name: string) => resource("aws_s3_bucket", "b", { bucket: name, id: name });
const pab = (bucketRef: string) =>
  resource("aws_s3_bucket_public_access_block", "b", {
    bucket: bucketRef,
    block_public_acls: false,
    block_public_policy: false,
    ignore_public_acls: false,
    restrict_public_buckets: false,
  });

describe("associationEdges", () => {
  it("ties a public-access block to the bucket it configures", () => {
    const edges = associationEdges(setOf([bucket("my-assets"), pab("my-assets")]));
    expect(edges).toEqual([
      { from: "aws_s3_bucket_public_access_block.b", to: "aws_s3_bucket.b" },
    ]);
  });

  it("returns nothing when the block targets a different bucket name", () => {
    expect(associationEdges(setOf([bucket("my-assets"), pab("other-bucket")]))).toEqual([]);
  });

  it("returns nothing when there is no public-access block", () => {
    expect(associationEdges(setOf([bucket("my-assets")]))).toEqual([]);
  });
});
