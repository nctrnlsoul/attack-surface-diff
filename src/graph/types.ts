// Attack-path graph model: the pure output of the Days 3-4 engine.
//
// A graph is built per side (before / after) from a parsed `ResourceSet`. It
// holds a synthetic INTERNET node plus one node per modeled resource, and
// directed declared-reachability edges pointing attacker-inward (from INTERNET
// toward data stores). BFS/DFS over these edges yields attack paths; the diff of
// before vs after path sets drives the red (new) / green (closed) visualization.

import type { ParsedPlan, ModeledResource } from "../parser/types.js";

/** The synthetic node id representing the public internet. */
export const INTERNET = "INTERNET";

/** A node kind: the synthetic internet, or a modeled resource's type. */
export type NodeKind = "internet" | ModeledResource["resourceType"];

export interface GraphNode {
  /** "INTERNET" or the resource's Terraform address. */
  id: string;
  kind: NodeKind;
  /** Human-friendly label, e.g. "aws_db_instance.prod" or "INTERNET". */
  label: string;
  /** True for resources an attack path terminates at (RDS, S3 in v1). */
  isDataStore: boolean;
}

/** Why a directed reachability edge exists. */
export type EdgeReason =
  | "internet_ingress" // INTERNET -> SG via 0.0.0.0/0 or ::/0 ingress
  | "sg_reference" // SG(source) -> SG(owner) via SG-to-SG ingress reference
  | "sg_membership" // SG -> resource that is a member of the SG
  | "s3_public_access"; // INTERNET -> bucket whose public access is not blocked

export interface GraphEdge {
  from: string;
  to: string;
  reason: EdgeReason;
  /** Optional human detail, e.g. "tcp 5432 from 0.0.0.0/0". */
  detail: string | null;
}

export interface AttackGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** A simple path from INTERNET to a data store. */
export interface AttackPath {
  /** Ordered node ids, INTERNET first, the data store last. */
  nodes: string[];
  /** The terminal data-store node id. */
  dataStore: string;
  /** Diff identity: `nodes.join(" -> ")`. */
  key: string;
}

/** Set difference of two attack-path collections, keyed by path identity. */
export interface PathDiff {
  /** In after, not before: newly opened paths (render red). */
  added: AttackPath[];
  /** In before, not after: closed paths (render green). */
  removed: AttackPath[];
  /** In both: unchanged paths. */
  unchanged: AttackPath[];
}

/** One side of the plan (before or after), analyzed. */
export interface SideAnalysis {
  graph: AttackGraph;
  paths: AttackPath[];
}

/** The full analysis of a parsed plan: both sides plus the path diff. */
export interface PlanAnalysis {
  before: SideAnalysis;
  after: SideAnalysis;
  diff: PathDiff;
}

export type { ParsedPlan };
