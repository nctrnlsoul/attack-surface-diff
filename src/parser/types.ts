// Typed resource model for the Attack-Surface Diff parser core.
//
// This is the pure output shape of `parsePlan`. It has no framework, network,
// file, or environment coupling. Every modeled resource keeps a typed subset of
// the security-relevant attributes the graph phase will need, plus `raw` (the
// untouched original Terraform `values` object) so nothing is lost downstream.

/** A JSON object as it appears inside a Terraform plan. */
export type RawValues = Record<string, unknown>;

/** Fields present on every parsed resource, modeled or not. */
export interface ResourceBase {
  /** Unique Terraform address, e.g. "aws_instance.web" or "module.x.aws_db_instance.db". */
  address: string;
  /** Terraform resource type string, e.g. "aws_security_group". */
  type: string;
  /** Terraform local name, e.g. "web". */
  name: string;
  /** Provider name if present, e.g. "registry.terraform.io/hashicorp/aws". */
  provider: string | null;
  /** The untouched original `values` object for this resource. */
  raw: RawValues;
}

/** One inline ingress/egress block on an `aws_security_group`. */
export interface SecurityGroupRuleBlock {
  fromPort: number | null;
  toPort: number | null;
  protocol: string | null;
  cidrBlocks: string[];
  ipv6CidrBlocks: string[];
  /** Referenced security group ids (SG-to-SG references). */
  securityGroups: string[];
  /** Whether the rule references the SG itself. */
  self: boolean;
}

/** One route entry on an `aws_route_table`. */
export interface RouteEntry {
  cidrBlock: string | null;
  /** Gateway id; an "igw-" value signals a route to the internet. */
  gatewayId: string | null;
}

export interface SecurityGroup extends ResourceBase {
  resourceType: "security_group";
  id: string | null;
  vpcId: string | null;
  ingress: SecurityGroupRuleBlock[];
  egress: SecurityGroupRuleBlock[];
}

export interface SecurityGroupRule extends ResourceBase {
  resourceType: "security_group_rule";
  ruleType: "ingress" | "egress" | null;
  securityGroupId: string | null;
  fromPort: number | null;
  toPort: number | null;
  protocol: string | null;
  cidrBlocks: string[];
  ipv6CidrBlocks: string[];
  sourceSecurityGroupId: string | null;
  self: boolean;
}

export interface Ec2Instance extends ResourceBase {
  resourceType: "ec2_instance";
  id: string | null;
  subnetId: string | null;
  vpcSecurityGroupIds: string[];
  associatePublicIpAddress: boolean | null;
  ami: string | null;
}

export interface LoadBalancer extends ResourceBase {
  resourceType: "load_balancer";
  lbName: string | null;
  /** true = internal, false = internet-facing. */
  internal: boolean | null;
  /** "application" or "network". */
  loadBalancerType: string | null;
  securityGroups: string[];
  subnets: string[];
}

export interface DbInstance extends ResourceBase {
  resourceType: "db_instance";
  identifier: string | null;
  publiclyAccessible: boolean | null;
  vpcSecurityGroupIds: string[];
  dbSubnetGroupName: string | null;
  engine: string | null;
}

export interface S3Bucket extends ResourceBase {
  resourceType: "s3_bucket";
  bucket: string | null;
}

export interface S3BucketPublicAccessBlock extends ResourceBase {
  resourceType: "s3_bucket_public_access_block";
  /** The bucket this config applies to (id or name reference). */
  bucket: string | null;
  blockPublicAcls: boolean | null;
  blockPublicPolicy: boolean | null;
  ignorePublicAcls: boolean | null;
  restrictPublicBuckets: boolean | null;
}

export interface LambdaFunction extends ResourceBase {
  resourceType: "lambda_function";
  functionName: string | null;
  vpcSubnetIds: string[];
  vpcSecurityGroupIds: string[];
}

export interface ApiGatewayRestApi extends ResourceBase {
  resourceType: "api_gateway_rest_api";
  apiName: string | null;
  /** endpoint_configuration.types, e.g. ["REGIONAL"] or ["EDGE"] or ["PRIVATE"]. */
  endpointTypes: string[];
}

export interface Vpc extends ResourceBase {
  resourceType: "vpc";
  id: string | null;
  cidrBlock: string | null;
}

export interface Subnet extends ResourceBase {
  resourceType: "subnet";
  id: string | null;
  vpcId: string | null;
  cidrBlock: string | null;
  mapPublicIpOnLaunch: boolean | null;
}

export interface RouteTable extends ResourceBase {
  resourceType: "route_table";
  id: string | null;
  vpcId: string | null;
  routes: RouteEntry[];
}

export interface IamRole extends ResourceBase {
  resourceType: "iam_role";
  roleName: string | null;
}

export interface IamPolicy extends ResourceBase {
  resourceType: "iam_policy";
  policyName: string | null;
}

/** The discriminated union of every modeled AWS resource. */
export type ModeledResource =
  | SecurityGroup
  | SecurityGroupRule
  | Ec2Instance
  | LoadBalancer
  | DbInstance
  | S3Bucket
  | S3BucketPublicAccessBlock
  | LambdaFunction
  | ApiGatewayRestApi
  | Vpc
  | Subnet
  | RouteTable
  | IamRole
  | IamPolicy;

/** A resource with a valid shape whose type is not modeled. Never dropped. */
export interface UnmodeledResource {
  address: string;
  type: string;
  name: string;
  raw: RawValues;
}

/** One side of the diff: the modeled resources plus the unmodeled leftovers. */
export interface ResourceSet {
  resources: ModeledResource[];
  unmodeled: UnmodeledResource[];
}

export interface ParsedPlan {
  formatVersion: string | null;
  terraformVersion: string | null;
  /** From `prior_state` (the "before" state). Empty on a first apply. */
  before: ResourceSet;
  /** From `planned_values` (the "after" state). */
  after: ResourceSet;
}

export type ParseErrorCode =
  | "INVALID_JSON"
  | "NOT_AN_OBJECT"
  | "MISSING_PLAN_STATES"
  | "MALFORMED_STATE"
  | "MALFORMED_RESOURCE";

/** A clear, typed failure. The parser never returns a partial result. */
export interface ParseError {
  code: ParseErrorCode;
  message: string;
  /** Where in the input the failure occurred, e.g. "planned_values.root_module.resources[3]". */
  path: string;
}

/** Fail-closed result: either a full plan or a typed error. Never partial. */
export type ParseResult =
  | { ok: true; plan: ParsedPlan }
  | { ok: false; error: ParseError };
