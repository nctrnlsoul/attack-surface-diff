// Per-type field extractors for the modeled AWS resource set, plus the small
// value-coercion helpers they share.
//
// Design note on strictness: structure is checked strictly at the resource-entry
// level in parse.ts (a resource must have string type/address/name and an object
// `values`, or the whole parse fails closed). Individual ATTRIBUTE values are
// coerced leniently here: a missing or wrong-typed attribute becomes null or [],
// never a parse failure. A weird attribute value is not "unknown-shaped input";
// it is a normal, incomplete plan attribute (Terraform leaves computed values
// unknown until apply). Fail-closed guards the envelope, not every leaf.

import type {
  ModeledResource,
  RawValues,
  ResourceBase,
  RouteEntry,
  SecurityGroupRuleBlock,
} from "./types.js";

// --- coercion helpers -------------------------------------------------------

export function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function asString(x: unknown): string | null {
  return typeof x === "string" ? x : null;
}

function asBool(x: unknown): boolean | null {
  return typeof x === "boolean" ? x : null;
}

function asNumber(x: unknown): number | null {
  return typeof x === "number" ? x : null;
}

function asStringArray(x: unknown): string[] {
  if (!Array.isArray(x)) return [];
  return x.filter((v): v is string => typeof v === "string");
}

/** First block of a Terraform list-nested block (e.g. `vpc_config`, `endpoint_configuration`). */
function firstBlock(x: unknown): Record<string, unknown> | null {
  if (!Array.isArray(x)) return null;
  const head = x[0];
  return isObject(head) ? head : null;
}

function toSgRuleBlocks(x: unknown): SecurityGroupRuleBlock[] {
  if (!Array.isArray(x)) return [];
  const out: SecurityGroupRuleBlock[] = [];
  for (const r of x) {
    if (!isObject(r)) continue;
    out.push({
      fromPort: asNumber(r["from_port"]),
      toPort: asNumber(r["to_port"]),
      protocol: asString(r["protocol"]),
      cidrBlocks: asStringArray(r["cidr_blocks"]),
      ipv6CidrBlocks: asStringArray(r["ipv6_cidr_blocks"]),
      securityGroups: asStringArray(r["security_groups"]),
      self: asBool(r["self"]) ?? false,
    });
  }
  return out;
}

function toRouteEntries(x: unknown): RouteEntry[] {
  if (!Array.isArray(x)) return [];
  const out: RouteEntry[] = [];
  for (const r of x) {
    if (!isObject(r)) continue;
    out.push({
      cidrBlock: asString(r["cidr_block"]),
      gatewayId: asString(r["gateway_id"]),
    });
  }
  return out;
}

// --- extractor registry -----------------------------------------------------

type Extractor = (base: ResourceBase, v: RawValues) => ModeledResource;

/**
 * Maps a Terraform resource type string to its modeled extractor. The keys here
 * are the full recognized set behind the MVP scope's resource categories.
 *
 * TODO(graph-slice): LB listener / target-group types (aws_lb_listener,
 * aws_lb_target_group) are intentionally NOT modeled in this parser slice. Add
 * them when the graph builder needs LB-to-target reachability edges.
 */
const EXTRACTORS: Record<string, Extractor> = {
  aws_security_group: (base, v) => ({
    ...base,
    resourceType: "security_group",
    id: asString(v["id"]),
    vpcId: asString(v["vpc_id"]),
    ingress: toSgRuleBlocks(v["ingress"]),
    egress: toSgRuleBlocks(v["egress"]),
  }),

  aws_security_group_rule: (base, v) => {
    const ruleTypeRaw = asString(v["type"]);
    const ruleType =
      ruleTypeRaw === "ingress" || ruleTypeRaw === "egress" ? ruleTypeRaw : null;
    return {
      ...base,
      resourceType: "security_group_rule",
      ruleType,
      securityGroupId: asString(v["security_group_id"]),
      fromPort: asNumber(v["from_port"]),
      toPort: asNumber(v["to_port"]),
      protocol: asString(v["protocol"]),
      cidrBlocks: asStringArray(v["cidr_blocks"]),
      ipv6CidrBlocks: asStringArray(v["ipv6_cidr_blocks"]),
      sourceSecurityGroupId: asString(v["source_security_group_id"]),
      self: asBool(v["self"]) ?? false,
    };
  },

  aws_instance: (base, v) => ({
    ...base,
    resourceType: "ec2_instance",
    id: asString(v["id"]),
    subnetId: asString(v["subnet_id"]),
    vpcSecurityGroupIds: asStringArray(v["vpc_security_group_ids"]),
    associatePublicIpAddress: asBool(v["associate_public_ip_address"]),
    ami: asString(v["ami"]),
  }),

  aws_lb: (base, v) => ({
    ...base,
    resourceType: "load_balancer",
    lbName: asString(v["name"]),
    internal: asBool(v["internal"]),
    loadBalancerType: asString(v["load_balancer_type"]),
    securityGroups: asStringArray(v["security_groups"]),
    subnets: asStringArray(v["subnets"]),
  }),

  aws_db_instance: (base, v) => ({
    ...base,
    resourceType: "db_instance",
    identifier: asString(v["identifier"]),
    publiclyAccessible: asBool(v["publicly_accessible"]),
    vpcSecurityGroupIds: asStringArray(v["vpc_security_group_ids"]),
    dbSubnetGroupName: asString(v["db_subnet_group_name"]),
    engine: asString(v["engine"]),
  }),

  aws_s3_bucket: (base, v) => ({
    ...base,
    resourceType: "s3_bucket",
    bucket: asString(v["bucket"]),
  }),

  aws_s3_bucket_public_access_block: (base, v) => ({
    ...base,
    resourceType: "s3_bucket_public_access_block",
    bucket: asString(v["bucket"]),
    blockPublicAcls: asBool(v["block_public_acls"]),
    blockPublicPolicy: asBool(v["block_public_policy"]),
    ignorePublicAcls: asBool(v["ignore_public_acls"]),
    restrictPublicBuckets: asBool(v["restrict_public_buckets"]),
  }),

  aws_lambda_function: (base, v) => {
    const vpcConfig = firstBlock(v["vpc_config"]);
    return {
      ...base,
      resourceType: "lambda_function",
      functionName: asString(v["function_name"]),
      vpcSubnetIds: asStringArray(vpcConfig?.["subnet_ids"]),
      vpcSecurityGroupIds: asStringArray(vpcConfig?.["security_group_ids"]),
    };
  },

  aws_api_gateway_rest_api: (base, v) => {
    const endpoint = firstBlock(v["endpoint_configuration"]);
    return {
      ...base,
      resourceType: "api_gateway_rest_api",
      apiName: asString(v["name"]),
      endpointTypes: asStringArray(endpoint?.["types"]),
    };
  },

  aws_vpc: (base, v) => ({
    ...base,
    resourceType: "vpc",
    id: asString(v["id"]),
    cidrBlock: asString(v["cidr_block"]),
  }),

  aws_subnet: (base, v) => ({
    ...base,
    resourceType: "subnet",
    id: asString(v["id"]),
    vpcId: asString(v["vpc_id"]),
    cidrBlock: asString(v["cidr_block"]),
    mapPublicIpOnLaunch: asBool(v["map_public_ip_on_launch"]),
  }),

  aws_route_table: (base, v) => ({
    ...base,
    resourceType: "route_table",
    id: asString(v["id"]),
    vpcId: asString(v["vpc_id"]),
    routes: toRouteEntries(v["route"]),
  }),

  aws_iam_role: (base, v) => ({
    ...base,
    resourceType: "iam_role",
    roleName: asString(v["name"]),
  }),

  aws_iam_policy: (base, v) => ({
    ...base,
    resourceType: "iam_policy",
    policyName: asString(v["name"]),
  }),
};

/** ALB is exposed as `aws_lb`; `aws_alb` is a legacy alias for the same shape. */
EXTRACTORS["aws_alb"] = EXTRACTORS["aws_lb"] as Extractor;

/** Returns the extractor for a Terraform type, or null if the type is not modeled. */
export function extractorFor(type: string): Extractor | null {
  return EXTRACTORS[type] ?? null;
}
