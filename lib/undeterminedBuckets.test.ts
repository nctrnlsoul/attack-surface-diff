import { describe, expect, it } from "vitest";

import { parsePlan } from "../src/parser/parse.js";
import type { ResourceSet } from "../src/parser/types.js";
import { planWithAfter, resource } from "../src/parser/fixtures/plans.js";
import { undeterminedBuckets } from "./undeterminedBuckets.js";

function setOf(resources: unknown[]): ResourceSet {
  const result = parsePlan(planWithAfter(resources));
  if (!result.ok) throw new Error(`fixture failed to parse: ${result.error.message}`);
  return result.plan.after;
}

const bucket = (name: string, bucketValue: string | null = name) =>
  resource("aws_s3_bucket", name, { bucket: bucketValue, id: bucketValue });
const pab = (name: string, bucketRef: string) =>
  resource("aws_s3_bucket_public_access_block", name, {
    bucket: bucketRef,
    block_public_acls: true,
    block_public_policy: true,
    ignore_public_acls: true,
    restrict_public_buckets: true,
  });

describe("undeterminedBuckets", () => {
  it("does not flag a bucket that has a matching public-access block", () => {
    expect(undeterminedBuckets(setOf([bucket("assets"), pab("assets", "assets")]))).toEqual([]);
  });

  it("does not flag a bucket with a permissive (unlocked) block — it is determined, exposed", () => {
    // "undetermined" is about the ABSENCE of a block, never its flags, so it can
    // never overlap the exposed set the engine renders as a red path.
    const permissive = resource("aws_s3_bucket_public_access_block", "assets", {
      bucket: "assets",
      block_public_acls: false,
      block_public_policy: false,
      ignore_public_acls: false,
      restrict_public_buckets: false,
    });
    expect(undeterminedBuckets(setOf([bucket("assets"), permissive]))).toEqual([]);
  });

  it("flags a bucket with no public-access block", () => {
    expect(undeterminedBuckets(setOf([bucket("logs")]))).toEqual(["aws_s3_bucket.logs"]);
  });

  it("flags a bucket whose block targets a different bucket name", () => {
    const edges = undeterminedBuckets(setOf([bucket("logs"), pab("other", "other-bucket")]));
    expect(edges).toEqual(["aws_s3_bucket.logs"]);
  });

  it("flags a bucket with an unknown (null) name", () => {
    expect(undeterminedBuckets(setOf([bucket("new", null)]))).toEqual(["aws_s3_bucket.new"]);
  });

  it("returns nothing when there are no buckets", () => {
    expect(undeterminedBuckets(setOf([resource("aws_vpc", "v", { id: "vpc-1" })]))).toEqual([]);
  });
});
