import { describe, expect, it } from "vitest";

import { parsePlan, parsePlanJson } from "./parse.js";
import type { ModeledResource } from "./types.js";
import {
  oneOfEachModeled,
  planWithAfter,
  plannedValues,
  priorState,
  resource,
} from "./fixtures/plans.js";

/** Assert a successful parse and return the plan (fails the test otherwise). */
function expectOk(input: unknown) {
  const result = parsePlan(input);
  if (!result.ok) {
    throw new Error(`expected ok parse, got error: ${result.error.code} ${result.error.message}`);
  }
  return result.plan;
}

/** Find a single modeled resource of a given resourceType in the "after" set. */
function afterOf<T extends ModeledResource["resourceType"]>(
  input: unknown,
  resourceType: T,
): Extract<ModeledResource, { resourceType: T }> {
  const plan = expectOk(input);
  const match = plan.after.resources.find((r) => r.resourceType === resourceType);
  if (!match) throw new Error(`no modeled resource of type ${resourceType} found`);
  return match as Extract<ModeledResource, { resourceType: T }>;
}

describe("fail-closed: unparseable or unknown-shaped input", () => {
  it("returns INVALID_JSON for a non-JSON string, never a partial result", () => {
    const result = parsePlanJson("{ this is not json");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_JSON");
  });

  it.each([
    ["null", null],
    ["an array", []],
    ["a number", 42],
    ["a string", "plan"],
  ])("returns NOT_AN_OBJECT when the top level is %s", (_label, input) => {
    const result = parsePlan(input);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NOT_AN_OBJECT");
  });

  it("returns MISSING_PLAN_STATES when neither prior_state nor planned_values is present", () => {
    const result = parsePlan({ format_version: "1.0", terraform_version: "1.9.5" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("MISSING_PLAN_STATES");
  });

  it("returns MALFORMED_STATE when planned_values is present but the wrong shape", () => {
    const result = parsePlan({ planned_values: "nope" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("MALFORMED_STATE");
  });

  it("returns MALFORMED_STATE when root_module.resources is not an array", () => {
    const result = parsePlan({ planned_values: { root_module: { resources: "nope" } } });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("MALFORMED_STATE");
    expect(result.error.path).toContain("resources");
  });

  it("returns MALFORMED_RESOURCE with a path when a resource is missing its type", () => {
    const broken = { address: "x.y", name: "y", values: {} }; // no `type`
    const result = parsePlan(planWithAfter([broken]));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("MALFORMED_RESOURCE");
    expect(result.error.path).toBe("planned_values.root_module.resources[0]");
  });

  it("returns MALFORMED_RESOURCE when a resource is missing its address", () => {
    const broken = { type: "aws_vpc", name: "y", values: {} }; // no `address`
    const result = parsePlan(planWithAfter([broken]));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("MALFORMED_RESOURCE");
  });

  it("returns MALFORMED_RESOURCE when a resource has no object `values`", () => {
    const broken = { type: "aws_vpc", address: "aws_vpc.y", name: "y" }; // no `values`
    const result = parsePlan(planWithAfter([broken]));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("MALFORMED_RESOURCE");
  });

  it("fails the whole parse on one malformed resource, never a partial result", () => {
    const good = resource("aws_vpc", "ok", { id: "vpc-1", cidr_block: "10.0.0.0/16" });
    const broken = { type: "aws_vpc", name: "y", values: {} }; // no `address`
    const result = parsePlan(planWithAfter([good, broken]));
    // Must be a clean error, not a plan that silently kept only the good one.
    expect(result.ok).toBe(false);
  });
});

describe("valid empty and partial states", () => {
  it("treats an absent prior_state as an empty before-set (first apply)", () => {
    const plan = expectOk(planWithAfter([resource("aws_vpc", "v", { id: "vpc-1" })]));
    expect(plan.before.resources).toHaveLength(0);
    expect(plan.before.unmodeled).toHaveLength(0);
    expect(plan.after.resources).toHaveLength(1);
  });

  it("treats a present-but-empty prior_state (no values) as an empty before-set", () => {
    const input = {
      prior_state: { format_version: "1.0" },
      planned_values: plannedValues([resource("aws_vpc", "v", { id: "vpc-1" })]),
    };
    const plan = expectOk(input);
    expect(plan.before.resources).toHaveLength(0);
    expect(plan.after.resources).toHaveLength(1);
  });

  it("accepts a plan with only prior_state and an empty planned side", () => {
    const input = { prior_state: priorState([resource("aws_vpc", "v", { id: "vpc-1" })]) };
    const plan = expectOk(input);
    expect(plan.before.resources).toHaveLength(1);
    expect(plan.after.resources).toHaveLength(0);
  });
});

describe("reads both states and recurses child modules", () => {
  it("populates before from prior_state and after from planned_values", () => {
    const input = {
      format_version: "1.0",
      prior_state: priorState([resource("aws_s3_bucket", "old", { bucket: "old" })]),
      planned_values: plannedValues([resource("aws_s3_bucket", "new", { bucket: "new" })]),
    };
    const plan = expectOk(input);
    expect(plan.before.resources.map((r) => r.address)).toEqual(["aws_s3_bucket.old"]);
    expect(plan.after.resources.map((r) => r.address)).toEqual(["aws_s3_bucket.new"]);
  });

  it("recurses into child_modules", () => {
    const child = { resources: [resource("aws_vpc", "child", { id: "vpc-child" })] };
    const input = planWithAfter([resource("aws_vpc", "root", { id: "vpc-root" })], [child]);
    const plan = expectOk(input);
    const ids = plan.after.resources.map((r) => r.address).sort();
    expect(ids).toEqual(["aws_vpc.child", "aws_vpc.root"]);
  });
});

describe("unmodeled resources are collected, not dropped", () => {
  it("puts a valid-but-unmodeled type into unmodeled, not an error", () => {
    const input = planWithAfter([
      resource("aws_sns_topic", "alerts", { name: "alerts" }),
      resource("aws_vpc", "main", { id: "vpc-1" }),
    ]);
    const plan = expectOk(input);
    expect(plan.after.resources.map((r) => r.type)).toEqual(["aws_vpc"]);
    expect(plan.after.unmodeled.map((r) => r.type)).toEqual(["aws_sns_topic"]);
    expect(plan.after.unmodeled[0]?.raw).toEqual({ name: "alerts" });
  });
});

describe("metadata and raw preservation", () => {
  it("captures format and terraform versions", () => {
    const plan = expectOk(planWithAfter([]));
    expect(plan.formatVersion).toBe("1.0");
    expect(plan.terraformVersion).toBe("1.9.5");
  });

  it("preserves the raw values object on a modeled resource", () => {
    const raw = { id: "vpc-1", cidr_block: "10.0.0.0/16", tags: { env: "prod" } };
    const vpc = afterOf(planWithAfter([resource("aws_vpc", "main", raw)]), "vpc");
    expect(vpc.raw).toEqual(raw);
  });

  it("treats aws_alb as an alias of aws_lb", () => {
    const lb = afterOf(
      planWithAfter([resource("aws_alb", "legacy", { name: "legacy", internal: true })]),
      "load_balancer",
    );
    expect(lb.lbName).toBe("legacy");
    expect(lb.internal).toBe(true);
  });
});

describe("per-type field extraction", () => {
  it("models all 14 types from a one-of-each plan and leaves unmodeled empty", () => {
    const plan = expectOk(planWithAfter(oneOfEachModeled()));
    expect(plan.after.resources).toHaveLength(14);
    expect(plan.after.unmodeled).toHaveLength(0);
  });

  it("security_group: keeps 0.0.0.0/0 ingress with ports and protocol", () => {
    const sg = afterOf(planWithAfter(oneOfEachModeled()), "security_group");
    expect(sg.vpcId).toBe("vpc-1");
    expect(sg.ingress).toHaveLength(1);
    expect(sg.ingress[0]?.cidrBlocks).toEqual(["0.0.0.0/0"]);
    expect(sg.ingress[0]?.fromPort).toBe(5432);
    expect(sg.ingress[0]?.protocol).toBe("tcp");
  });

  it("security_group_rule: keeps direction and CIDRs", () => {
    const rule = afterOf(planWithAfter(oneOfEachModeled()), "security_group_rule");
    expect(rule.ruleType).toBe("ingress");
    expect(rule.securityGroupId).toBe("sg-db");
    expect(rule.cidrBlocks).toEqual(["0.0.0.0/0"]);
  });

  it("ec2_instance: keeps public-ip flag and SG ids", () => {
    const ec2 = afterOf(planWithAfter(oneOfEachModeled()), "ec2_instance");
    expect(ec2.associatePublicIpAddress).toBe(true);
    expect(ec2.vpcSecurityGroupIds).toEqual(["sg-web"]);
    expect(ec2.subnetId).toBe("subnet-pub");
  });

  it("load_balancer: keeps internal flag and type", () => {
    const lb = afterOf(planWithAfter(oneOfEachModeled()), "load_balancer");
    expect(lb.internal).toBe(false);
    expect(lb.loadBalancerType).toBe("application");
    expect(lb.securityGroups).toEqual(["sg-web"]);
  });

  it("db_instance: keeps publicly_accessible and SG ids", () => {
    const db = afterOf(planWithAfter(oneOfEachModeled()), "db_instance");
    expect(db.identifier).toBe("prod-db");
    expect(db.publiclyAccessible).toBe(false);
    expect(db.vpcSecurityGroupIds).toEqual(["sg-db"]);
  });

  it("s3_bucket: keeps the bucket name", () => {
    const s3 = afterOf(planWithAfter(oneOfEachModeled()), "s3_bucket");
    expect(s3.bucket).toBe("my-assets");
  });

  it("s3_bucket_public_access_block: keeps all four block flags and the bucket ref", () => {
    const pab = afterOf(planWithAfter(oneOfEachModeled()), "s3_bucket_public_access_block");
    expect(pab.bucket).toBe("my-assets");
    expect(pab.blockPublicAcls).toBe(false);
    expect(pab.blockPublicPolicy).toBe(false);
    expect(pab.ignorePublicAcls).toBe(false);
    expect(pab.restrictPublicBuckets).toBe(false);
  });

  it("lambda_function: flattens vpc_config subnet and SG ids", () => {
    const fn = afterOf(planWithAfter(oneOfEachModeled()), "lambda_function");
    expect(fn.functionName).toBe("worker");
    expect(fn.vpcSubnetIds).toEqual(["subnet-priv"]);
    expect(fn.vpcSecurityGroupIds).toEqual(["sg-lambda"]);
  });

  it("api_gateway_rest_api: flattens endpoint_configuration types", () => {
    const api = afterOf(planWithAfter(oneOfEachModeled()), "api_gateway_rest_api");
    expect(api.apiName).toBe("public-api");
    expect(api.endpointTypes).toEqual(["REGIONAL"]);
  });

  it("vpc: keeps cidr", () => {
    const vpc = afterOf(planWithAfter(oneOfEachModeled()), "vpc");
    expect(vpc.cidrBlock).toBe("10.0.0.0/16");
  });

  it("subnet: keeps map_public_ip_on_launch", () => {
    const subnet = afterOf(planWithAfter(oneOfEachModeled()), "subnet");
    expect(subnet.mapPublicIpOnLaunch).toBe(true);
    expect(subnet.vpcId).toBe("vpc-1");
  });

  it("route_table: keeps a route to an internet gateway", () => {
    const rt = afterOf(planWithAfter(oneOfEachModeled()), "route_table");
    expect(rt.routes).toHaveLength(1);
    expect(rt.routes[0]?.cidrBlock).toBe("0.0.0.0/0");
    expect(rt.routes[0]?.gatewayId).toBe("igw-1");
  });

  it("iam_role and iam_policy: keep their names (node metadata only)", () => {
    const plan = expectOk(planWithAfter(oneOfEachModeled()));
    const role = plan.after.resources.find((r) => r.resourceType === "iam_role");
    const policy = plan.after.resources.find((r) => r.resourceType === "iam_policy");
    expect(role?.resourceType === "iam_role" ? role.roleName : null).toBe("app-role");
    expect(policy?.resourceType === "iam_policy" ? policy.policyName : null).toBe("app-policy");
  });

  it("coerces a missing/unknown attribute to null without failing the parse", () => {
    // publicly_accessible is a computed value still unknown at plan time.
    const db = afterOf(
      planWithAfter([resource("aws_db_instance", "db", { identifier: "db" })]),
      "db_instance",
    );
    expect(db.publiclyAccessible).toBeNull();
    expect(db.vpcSecurityGroupIds).toEqual([]);
  });
});

describe("mixed set counts", () => {
  it("splits modeled and unmodeled correctly across both states", () => {
    const input = {
      prior_state: priorState([
        resource("aws_vpc", "v", { id: "vpc-1" }),
        resource("aws_cloudwatch_log_group", "logs", { name: "logs" }),
      ]),
      planned_values: plannedValues([
        resource("aws_vpc", "v", { id: "vpc-1" }),
        resource("aws_s3_bucket", "b", { bucket: "b" }),
        resource("aws_kms_key", "k", { description: "k" }),
      ]),
    };
    const plan = expectOk(input);
    expect(plan.before.resources).toHaveLength(1);
    expect(plan.before.unmodeled).toHaveLength(1);
    expect(plan.after.resources).toHaveLength(2);
    expect(plan.after.unmodeled).toHaveLength(1);
  });
});
