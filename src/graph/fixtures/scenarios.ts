// The three demo scenarios as full Terraform plan JSON (prior_state = before,
// planned_values = after), built from the Days 1-2 parser fixture helpers. These
// double as the "tests against the 3 sample plans" asset (build plan line 38).
// Polished demo JSON for the UI comes in a later slice; these are minimal and
// faithful to each scenario's reachability.

import { plannedValues, priorState, resource } from "../../parser/fixtures/plans.js";

/** Compose a single plan file holding both states. */
function makePlan(before: unknown[], after: unknown[]): unknown {
  return {
    format_version: "1.0",
    terraform_version: "1.9.5",
    prior_state: priorState(before),
    planned_values: plannedValues(after),
  };
}

// --- shared resource builders ----------------------------------------------

function webSg(ingressCidr: string): Record<string, unknown> {
  return resource("aws_security_group", "web", {
    id: "sg-web",
    vpc_id: "vpc-1",
    ingress: [
      {
        from_port: 443,
        to_port: 443,
        protocol: "tcp",
        cidr_blocks: [ingressCidr],
        ipv6_cidr_blocks: [],
        security_groups: [],
        self: false,
      },
    ],
    egress: [],
  });
}

/** db SG that allows ingress from a source SG on 5432. */
function dbSgFromSource(sourceSgId: string): Record<string, unknown> {
  return resource("aws_security_group", "db", {
    id: "sg-db",
    vpc_id: "vpc-1",
    ingress: [
      {
        from_port: 5432,
        to_port: 5432,
        protocol: "tcp",
        cidr_blocks: [],
        ipv6_cidr_blocks: [],
        security_groups: [sourceSgId],
        self: false,
      },
    ],
    egress: [],
  });
}

/** db SG that allows ingress directly from a CIDR on 5432. */
function dbSgFromCidr(ingressCidr: string): Record<string, unknown> {
  return resource("aws_security_group", "db", {
    id: "sg-db",
    vpc_id: "vpc-1",
    ingress: [
      {
        from_port: 5432,
        to_port: 5432,
        protocol: "tcp",
        cidr_blocks: [ingressCidr],
        ipv6_cidr_blocks: [],
        security_groups: [],
        self: false,
      },
    ],
    egress: [],
  });
}

function ec2Web(): Record<string, unknown> {
  return resource("aws_instance", "web", {
    id: "i-web",
    subnet_id: "subnet-pub",
    vpc_security_group_ids: ["sg-web"],
    associate_public_ip_address: true,
    ami: "ami-1",
  });
}

function rdsProd(): Record<string, unknown> {
  return resource("aws_db_instance", "prod", {
    identifier: "prod-db",
    publicly_accessible: false,
    vpc_security_group_ids: ["sg-db"],
    db_subnet_group_name: "db-subnets",
    engine: "postgres",
  });
}

function assetsBucket(): Record<string, unknown> {
  return resource("aws_s3_bucket", "assets", { bucket: "my-assets", id: "my-assets" });
}

function assetsPublicAccessBlock(blocked: boolean): Record<string, unknown> {
  return resource("aws_s3_bucket_public_access_block", "assets", {
    bucket: "my-assets",
    block_public_acls: blocked,
    block_public_policy: blocked,
    ignore_public_acls: blocked,
    restrict_public_buckets: blocked,
  });
}

// --- the three scenarios ----------------------------------------------------

/**
 * Scenario 1: a security group is opened to 0.0.0.0/0, exposing RDS through the
 * web tier. Path INTERNET -> web-sg -> db-sg -> rds appears only in `after`.
 */
export function scenarioSgOpenedExposesRds(): unknown {
  const shared = [dbSgFromSource("sg-web"), ec2Web(), rdsProd()];
  return makePlan(
    [webSg("10.0.0.0/8"), ...shared], // before: corporate CIDR only
    [webSg("0.0.0.0/0"), ...shared], // after: opened to the internet
  );
}

/**
 * Scenario 2: an S3 bucket is made public by relaxing its public-access block.
 * Path INTERNET -> s3(assets) appears only in `after`.
 */
export function scenarioS3MadePublic(): unknown {
  return makePlan(
    [assetsBucket(), assetsPublicAccessBlock(true)], // before: locked down
    [assetsBucket(), assetsPublicAccessBlock(false)], // after: public
  );
}

/**
 * Scenario 3: a fix PR closes an exposure. The db SG was open to 0.0.0.0/0 on
 * 5432 (INTERNET -> db-sg -> rds); the fix restricts it. The path is in `before`
 * only, so the diff reports it as removed (green).
 */
export function scenarioFixClosesRdsPath(): unknown {
  return makePlan(
    [dbSgFromCidr("0.0.0.0/0"), rdsProd()], // before: exposed
    [dbSgFromCidr("10.0.0.0/8"), rdsProd()], // after: fixed
  );
}
