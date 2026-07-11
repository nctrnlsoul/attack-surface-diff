// Test fixtures: small hand-built Terraform plan JSON shapes.
//
// Everything here is typed `unknown` / loose on purpose. These stand in for the
// output of `terraform show -json`, including deliberately malformed shapes used
// to exercise the fail-closed path. Real, larger scenario plans belong to later
// slices; these are focused on parser behavior.

/** A single resource entry as it appears in a Terraform values representation. */
export function resource(
  type: string,
  name: string,
  values: Record<string, unknown>,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    address: `${type}.${name}`,
    mode: "managed",
    type,
    name,
    provider_name: "registry.terraform.io/hashicorp/aws",
    values,
    ...extra,
  };
}

/** Wrap resources (and optional child modules) as a `planned_values` block. */
export function plannedValues(
  resources: unknown[],
  childModules: unknown[] = [],
): Record<string, unknown> {
  const rootModule: Record<string, unknown> = { resources };
  if (childModules.length > 0) rootModule["child_modules"] = childModules;
  return { root_module: rootModule };
}

/** Wrap resources as a `prior_state` block (note the extra `.values` nesting). */
export function priorState(resources: unknown[]): Record<string, unknown> {
  return {
    format_version: "1.0",
    values: { root_module: { resources } },
  };
}

/** A full, valid plan with only `planned_values`, holding the given resources. */
export function planWithAfter(resources: unknown[], childModules: unknown[] = []): unknown {
  return {
    format_version: "1.0",
    terraform_version: "1.9.5",
    planned_values: plannedValues(resources, childModules),
  };
}

/** One resource of each modeled type, with security-relevant attributes set. */
export function oneOfEachModeled(): unknown[] {
  return [
    resource("aws_security_group", "web", {
      id: "sg-web",
      vpc_id: "vpc-1",
      ingress: [
        {
          from_port: 5432,
          to_port: 5432,
          protocol: "tcp",
          cidr_blocks: ["0.0.0.0/0"],
          ipv6_cidr_blocks: [],
          security_groups: [],
          self: false,
        },
      ],
      egress: [],
    }),
    resource("aws_security_group_rule", "db_in", {
      type: "ingress",
      security_group_id: "sg-db",
      from_port: 5432,
      to_port: 5432,
      protocol: "tcp",
      cidr_blocks: ["0.0.0.0/0"],
      source_security_group_id: null,
      self: false,
    }),
    resource("aws_instance", "web", {
      id: "i-web",
      subnet_id: "subnet-pub",
      vpc_security_group_ids: ["sg-web"],
      associate_public_ip_address: true,
      ami: "ami-123",
    }),
    resource("aws_lb", "front", {
      name: "front-alb",
      internal: false,
      load_balancer_type: "application",
      security_groups: ["sg-web"],
      subnets: ["subnet-pub"],
    }),
    resource("aws_db_instance", "prod", {
      identifier: "prod-db",
      publicly_accessible: false,
      vpc_security_group_ids: ["sg-db"],
      db_subnet_group_name: "db-subnets",
      engine: "postgres",
    }),
    resource("aws_s3_bucket", "assets", { bucket: "my-assets" }),
    resource("aws_s3_bucket_public_access_block", "assets", {
      bucket: "my-assets",
      block_public_acls: false,
      block_public_policy: false,
      ignore_public_acls: false,
      restrict_public_buckets: false,
    }),
    resource("aws_lambda_function", "worker", {
      function_name: "worker",
      vpc_config: [{ subnet_ids: ["subnet-priv"], security_group_ids: ["sg-lambda"] }],
    }),
    resource("aws_api_gateway_rest_api", "api", {
      name: "public-api",
      endpoint_configuration: [{ types: ["REGIONAL"] }],
    }),
    resource("aws_vpc", "main", { id: "vpc-1", cidr_block: "10.0.0.0/16" }),
    resource("aws_subnet", "pub", {
      id: "subnet-pub",
      vpc_id: "vpc-1",
      cidr_block: "10.0.1.0/24",
      map_public_ip_on_launch: true,
    }),
    resource("aws_route_table", "pub", {
      id: "rtb-pub",
      vpc_id: "vpc-1",
      route: [{ cidr_block: "0.0.0.0/0", gateway_id: "igw-1" }],
    }),
    resource("aws_iam_role", "app", { name: "app-role" }),
    resource("aws_iam_policy", "app", { name: "app-policy" }),
  ];
}
