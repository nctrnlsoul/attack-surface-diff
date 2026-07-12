import { describe, expect, it } from "vitest";

import { parsePlan } from "../parser/parse.js";
import { resource } from "../parser/fixtures/plans.js";
import { diffAttackPaths, findAttackPaths } from "./paths.js";
import { analyzePlan } from "./analyze.js";
import { INTERNET, type AttackPath } from "./types.js";
import { graphOf, openIngress } from "./fixtures/testkit.js";
import {
  scenarioFixClosesRdsPath,
  scenarioS3MadePublic,
  scenarioSgOpenedExposesRds,
} from "./fixtures/scenarios.js";

describe("findAttackPaths", () => {
  it("finds a direct INTERNET -> SG -> RDS path", () => {
    const g = graphOf([
      resource("aws_security_group", "db", { id: "sg-db", ingress: [openIngress("0.0.0.0/0", 5432)], egress: [] }),
      resource("aws_db_instance", "prod", { identifier: "prod", vpc_security_group_ids: ["sg-db"] }),
    ]);
    const paths = findAttackPaths(g);
    expect(paths).toHaveLength(1);
    expect(paths[0]?.nodes).toEqual([INTERNET, "aws_security_group.db", "aws_db_instance.prod"]);
    expect(paths[0]?.dataStore).toBe("aws_db_instance.prod");
  });

  it("finds a multi-hop path through an SG-to-SG reference", () => {
    const g = graphOf([
      resource("aws_security_group", "web", { id: "sg-web", ingress: [openIngress("0.0.0.0/0", 443)], egress: [] }),
      resource("aws_security_group", "db", {
        id: "sg-db",
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
      }),
      resource("aws_db_instance", "prod", { identifier: "prod", vpc_security_group_ids: ["sg-db"] }),
    ]);
    const paths = findAttackPaths(g);
    const toRds = paths.find((p) => p.dataStore === "aws_db_instance.prod");
    expect(toRds?.nodes).toEqual([
      INTERNET,
      "aws_security_group.web",
      "aws_security_group.db",
      "aws_db_instance.prod",
    ]);
  });

  it("finds a two-node INTERNET -> S3 path for a public bucket", () => {
    const g = graphOf([
      resource("aws_s3_bucket", "assets", { bucket: "my-assets", id: "my-assets" }),
      resource("aws_s3_bucket_public_access_block", "assets", {
        bucket: "my-assets",
        block_public_acls: false,
        block_public_policy: false,
        ignore_public_acls: false,
        restrict_public_buckets: false,
      }),
    ]);
    const paths = findAttackPaths(g);
    expect(paths).toHaveLength(1);
    expect(paths[0]?.nodes).toEqual([INTERNET, "aws_s3_bucket.assets"]);
  });

  it("finds no path when nothing is open to the internet", () => {
    const g = graphOf([
      resource("aws_security_group", "db", { id: "sg-db", ingress: [openIngress("10.0.0.0/8", 5432)], egress: [] }),
      resource("aws_db_instance", "prod", { identifier: "prod", vpc_security_group_ids: ["sg-db"] }),
    ]);
    expect(findAttackPaths(g)).toHaveLength(0);
  });

  it("does not report a path for an internet-facing LB that dead-ends (no data store)", () => {
    const g = graphOf([
      resource("aws_security_group", "web", { id: "sg-web", ingress: [openIngress("0.0.0.0/0", 443)], egress: [] }),
      resource("aws_lb", "front", { name: "front", internal: false, security_groups: ["sg-web"] }),
    ]);
    expect(findAttackPaths(g)).toHaveLength(0);
  });

  it("respects the maxDepth bound", () => {
    // INTERNET -> web -> db -> rds needs 4 nodes; maxDepth 3 cannot reach it.
    const g = graphOf([
      resource("aws_security_group", "web", { id: "sg-web", ingress: [openIngress("0.0.0.0/0", 443)], egress: [] }),
      resource("aws_security_group", "db", {
        id: "sg-db",
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
      }),
      resource("aws_db_instance", "prod", { identifier: "prod", vpc_security_group_ids: ["sg-db"] }),
    ]);
    expect(findAttackPaths(g, 3)).toHaveLength(0);
    expect(findAttackPaths(g, 4)).toHaveLength(1);
  });
});

describe("diffAttackPaths", () => {
  const p = (nodes: string[]): AttackPath => ({
    nodes,
    dataStore: nodes[nodes.length - 1] as string,
    key: nodes.join(" -> "),
  });

  it("splits paths into added, removed, and unchanged", () => {
    const before = [p([INTERNET, "a", "db"]), p([INTERNET, "keep"])];
    const after = [p([INTERNET, "keep"]), p([INTERNET, "b", "db"])];
    const diff = diffAttackPaths(before, after);
    expect(diff.added.map((x) => x.key)).toEqual(["INTERNET -> b -> db"]);
    expect(diff.removed.map((x) => x.key)).toEqual(["INTERNET -> a -> db"]);
    expect(diff.unchanged.map((x) => x.key)).toEqual(["INTERNET -> keep"]);
  });
});

describe("demo scenarios end-to-end (parse -> analyze)", () => {
  it("scenario 1: opening a SG exposes RDS as one new (added) path", () => {
    const result = parsePlan(scenarioSgOpenedExposesRds());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const analysis = analyzePlan(result.plan);
    expect(analysis.before.paths).toHaveLength(0);
    expect(analysis.diff.added).toHaveLength(1);
    expect(analysis.diff.removed).toHaveLength(0);
    const added = analysis.diff.added[0];
    expect(added?.dataStore).toBe("aws_db_instance.prod");
    expect(added?.nodes).toContain("aws_security_group.web");
    expect(added?.nodes).toContain("aws_security_group.db");
  });

  it("scenario 2: making an S3 bucket public is one new (added) path", () => {
    const result = parsePlan(scenarioS3MadePublic());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const analysis = analyzePlan(result.plan);
    expect(analysis.diff.added).toHaveLength(1);
    expect(analysis.diff.added[0]?.dataStore).toBe("aws_s3_bucket.assets");
    expect(analysis.diff.removed).toHaveLength(0);
  });

  it("scenario 3: a fix PR closes the RDS path (one removed path)", () => {
    const result = parsePlan(scenarioFixClosesRdsPath());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const analysis = analyzePlan(result.plan);
    expect(analysis.after.paths).toHaveLength(0);
    expect(analysis.diff.removed).toHaveLength(1);
    expect(analysis.diff.added).toHaveLength(0);
    expect(analysis.diff.removed[0]?.dataStore).toBe("aws_db_instance.prod");
  });
});
