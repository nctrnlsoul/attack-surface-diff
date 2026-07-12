// The three preloaded demo scenarios, authored as app-owned Terraform plan
// objects (prior_state = before, planned_values = after). Deliberately NOT
// imported from src/graph/fixtures (that is test code) so the app stays
// decoupled. Scenario 1 includes an unmodeled resource so the "not analyzed"
// panel is visibly populated. These are the same shapes the engine tests verify.

/** A single managed resource entry inside a Terraform values representation. */
function res(type: string, name: string, values: Record<string, unknown>): Record<string, unknown> {
  return {
    address: `${type}.${name}`,
    mode: "managed",
    type,
    name,
    provider_name: "registry.terraform.io/hashicorp/aws",
    values,
  };
}

/** Compose a plan file holding both states (prior_state wraps in `.values`). */
function plan(before: unknown[], after: unknown[]): unknown {
  return {
    format_version: "1.0",
    terraform_version: "1.9.5",
    prior_state: { format_version: "1.0", values: { root_module: { resources: before } } },
    planned_values: { root_module: { resources: after } },
  };
}

const webSg = (cidr: string) =>
  res("aws_security_group", "web", {
    id: "sg-web",
    vpc_id: "vpc-1",
    ingress: [
      {
        from_port: 443,
        to_port: 443,
        protocol: "tcp",
        cidr_blocks: [cidr],
        ipv6_cidr_blocks: [],
        security_groups: [],
        self: false,
      },
    ],
    egress: [],
  });

const dbSgFromWeb = () =>
  res("aws_security_group", "db", {
    id: "sg-db",
    vpc_id: "vpc-1",
    ingress: [
      {
        from_port: 5432,
        to_port: 5432,
        protocol: "tcp",
        cidr_blocks: [],
        ipv6_cidr_blocks: [],
        security_groups: ["sg-web"],
        self: false,
      },
    ],
    egress: [],
  });

const dbSgFromCidr = (cidr: string) =>
  res("aws_security_group", "db", {
    id: "sg-db",
    vpc_id: "vpc-1",
    ingress: [
      {
        from_port: 5432,
        to_port: 5432,
        protocol: "tcp",
        cidr_blocks: [cidr],
        ipv6_cidr_blocks: [],
        security_groups: [],
        self: false,
      },
    ],
    egress: [],
  });

const ec2Web = () =>
  res("aws_instance", "web", {
    id: "i-web",
    subnet_id: "subnet-pub",
    vpc_security_group_ids: ["sg-web"],
    associate_public_ip_address: true,
    ami: "ami-1",
  });

const rdsProd = () =>
  res("aws_db_instance", "prod", {
    identifier: "prod-db",
    publicly_accessible: false,
    vpc_security_group_ids: ["sg-db"],
    db_subnet_group_name: "db-subnets",
    engine: "postgres",
  });

// An unmodeled type (no reachability model) to exercise the "not analyzed" panel.
const alertsTopic = () => res("aws_sns_topic", "alerts", { name: "deploy-alerts" });

const assetsBucket = () => res("aws_s3_bucket", "assets", { bucket: "my-assets", id: "my-assets" });
const assetsPab = (blocked: boolean) =>
  res("aws_s3_bucket_public_access_block", "assets", {
    bucket: "my-assets",
    block_public_acls: blocked,
    block_public_policy: blocked,
    ignore_public_acls: blocked,
    restrict_public_buckets: blocked,
  });

export interface Demo {
  id: string;
  label: string;
  description: string;
  plan: unknown;
}

export const DEMOS: Demo[] = [
  {
    id: "sg-opened",
    label: "SG opened to 0.0.0.0/0",
    description: "A security group is opened to the internet, exposing RDS through the web tier.",
    plan: plan(
      [webSg("10.0.0.0/8"), dbSgFromWeb(), ec2Web(), rdsProd(), alertsTopic()],
      [webSg("0.0.0.0/0"), dbSgFromWeb(), ec2Web(), rdsProd(), alertsTopic()],
    ),
  },
  {
    id: "s3-public",
    label: "S3 bucket made public",
    description: "A bucket's public-access block is relaxed, exposing it to the internet.",
    plan: plan([assetsBucket(), assetsPab(true)], [assetsBucket(), assetsPab(false)]),
  },
  {
    id: "fix-closes",
    label: "Fix PR closes a path",
    description: "A fix restricts a database security group, closing an existing exposure.",
    plan: plan([dbSgFromCidr("0.0.0.0/0"), rdsProd()], [dbSgFromCidr("10.0.0.0/8"), rdsProd()]),
  },
];
