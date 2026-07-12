// Honest-claims helper: an S3 bucket with NO declared public-access block cannot
// be judged for internet exposure from the plan. The engine conservatively emits
// no exposure edge for such a bucket, which the UI must not present as "safe" —
// it is undetermined. This is a pure client derivation from the parsed resources;
// the engine is intentionally left untouched.

import type { ResourceSet } from "../src/parser/types.js";

/** Addresses of s3_bucket resources with no matching public-access block. */
export function undeterminedBuckets(set: ResourceSet): string[] {
  // Match by the `bucket` field — the same reference the engine's
  // addS3PublicAccessEdges (src/graph/build.ts) uses to decide exposure. "Has a
  // block" (any flags) means the engine determined it; only "no block" is
  // undetermined here, so this set never overlaps the exposed (red-path) set.
  const bucketNamesWithBlock = new Set<string>();
  for (const r of set.resources) {
    if (r.resourceType === "s3_bucket_public_access_block" && r.bucket !== null) {
      bucketNamesWithBlock.add(r.bucket);
    }
  }

  const out: string[] = [];
  for (const r of set.resources) {
    if (r.resourceType !== "s3_bucket") continue;
    // No bucket name, or a name with no matching block → exposure undetermined.
    if (r.bucket === null || !bucketNamesWithBlock.has(r.bucket)) {
      out.push(r.address);
    }
  }
  return out;
}
