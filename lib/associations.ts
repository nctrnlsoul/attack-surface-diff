// UI-only association edges: visually tie an S3 public-access block to the bucket
// it configures. The engine does not model this as a reachability edge (the block
// only influences whether INTERNET reaches the bucket), so it is derived here from
// the parsed ResourceSet and drawn dashed, never as an attack-path edge.

import type { ResourceSet } from "../src/parser/types.js";

export interface AssociationEdge {
  /** Node id (Terraform address) of the public-access block. */
  from: string;
  /** Node id (Terraform address) of the bucket it configures. */
  to: string;
}

export function associationEdges(set: ResourceSet): AssociationEdge[] {
  const bucketAddressByName = new Map<string, string>();
  for (const r of set.resources) {
    if (r.resourceType === "s3_bucket" && r.bucket !== null) {
      bucketAddressByName.set(r.bucket, r.address);
    }
  }

  const edges: AssociationEdge[] = [];
  for (const r of set.resources) {
    if (r.resourceType === "s3_bucket_public_access_block" && r.bucket !== null) {
      const bucketAddress = bucketAddressByName.get(r.bucket);
      if (bucketAddress !== undefined) {
        edges.push({ from: r.address, to: bucketAddress });
      }
    }
  }
  return edges;
}
