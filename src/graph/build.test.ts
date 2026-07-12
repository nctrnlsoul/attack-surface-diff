import { describe, expect, it } from "vitest";

import { resource } from "../parser/fixtures/plans.js";
import { buildGraph } from "./build.js";
import { INTERNET } from "./types.js";
import { edgesByReason, hasEdge, openIngress, setOf } from "./fixtures/testkit.js";

describe("nodes", () => {
  it("always includes the synthetic INTERNET node, even for an empty set", () => {
    const g = buildGraph(setOf([]));
    expect(g.nodes.map((n) => n.id)).toEqual([INTERNET]);
  });

  it("creates one node per modeled resource plus INTERNET", () => {
    const g = buildGraph(
      setOf([resource("aws_vpc", "main", { id: "vpc-1" }), resource("aws_s3_bucket", "b", { bucket: "b" })]),
    );
    expect(g.nodes.map((n) => n.id).sort()).toEqual([INTERNET, "aws_s3_bucket.b", "aws_vpc.main"]);
  });

  it("flags only db_instance and s3_bucket as data stores", () => {
    const g = buildGraph(
      setOf([
        resource("aws_db_instance", "db", { identifier: "db" }),
        resource("aws_s3_bucket", "b", { bucket: "b" }),
        resource("aws_instance", "web", { id: "i" }),
        resource("aws_vpc", "v", { id: "vpc-1" }),
      ]),
    );
    const dataStores = g.nodes.filter((n) => n.isDataStore).map((n) => n.id).sort();
    expect(dataStores).toEqual(["aws_db_instance.db", "aws_s3_bucket.b"]);
  });
});

describe("internet_ingress edges", () => {
  it("adds INTERNET -> SG for a 0.0.0.0/0 ingress and records port detail", () => {
    const g = buildGraph(
      setOf([
        resource("aws_security_group", "web", {
          id: "sg-web",
          ingress: [openIngress("0.0.0.0/0", 443)],
          egress: [],
        }),
      ]),
    );
    expect(hasEdge(g, INTERNET, "aws_security_group.web", "internet_ingress")).toBe(true);
    const edge = edgesByReason(g, "internet_ingress")[0];
    expect(edge?.detail).toBe("tcp 443 from 0.0.0.0/0");
  });

  it("adds INTERNET -> SG for an IPv6 ::/0 ingress", () => {
    const g = buildGraph(
      setOf([
        resource("aws_security_group", "web", {
          id: "sg-web",
          ingress: [
            {
              from_port: 0,
              to_port: 0,
              protocol: "-1",
              cidr_blocks: [],
              ipv6_cidr_blocks: ["::/0"],
              security_groups: [],
              self: false,
            },
          ],
          egress: [],
        }),
      ]),
    );
    expect(hasEdge(g, INTERNET, "aws_security_group.web", "internet_ingress")).toBe(true);
  });

  it("does not add an internet edge for a non-open CIDR", () => {
    const g = buildGraph(
      setOf([
        resource("aws_security_group", "web", {
          id: "sg-web",
          ingress: [openIngress("10.0.0.0/8")],
          egress: [],
        }),
      ]),
    );
    expect(edgesByReason(g, "internet_ingress")).toHaveLength(0);
  });

  it("adds an internet edge from a standalone open ingress rule", () => {
    const g = buildGraph(
      setOf([
        resource("aws_security_group", "db", { id: "sg-db", ingress: [], egress: [] }),
        resource("aws_security_group_rule", "open", {
          type: "ingress",
          security_group_id: "sg-db",
          from_port: 5432,
          to_port: 5432,
          protocol: "tcp",
          cidr_blocks: ["0.0.0.0/0"],
          source_security_group_id: null,
          self: false,
        }),
      ]),
    );
    expect(hasEdge(g, INTERNET, "aws_security_group.db", "internet_ingress")).toBe(true);
  });
});

describe("sg_reference edges", () => {
  it("adds source -> owner from an inline ingress SG reference", () => {
    const g = buildGraph(
      setOf([
        resource("aws_security_group", "web", { id: "sg-web", ingress: [], egress: [] }),
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
      ]),
    );
    expect(hasEdge(g, "aws_security_group.web", "aws_security_group.db", "sg_reference")).toBe(true);
  });

  it("adds source -> owner from a standalone rule's source_security_group_id", () => {
    const g = buildGraph(
      setOf([
        resource("aws_security_group", "web", { id: "sg-web", ingress: [], egress: [] }),
        resource("aws_security_group", "db", { id: "sg-db", ingress: [], egress: [] }),
        resource("aws_security_group_rule", "r", {
          type: "ingress",
          security_group_id: "sg-db",
          from_port: 5432,
          to_port: 5432,
          protocol: "tcp",
          cidr_blocks: [],
          source_security_group_id: "sg-web",
          self: false,
        }),
      ]),
    );
    expect(hasEdge(g, "aws_security_group.web", "aws_security_group.db", "sg_reference")).toBe(true);
  });
});

describe("sg_membership edges", () => {
  it("links a SG to EC2, RDS, LB, and Lambda members", () => {
    const g = buildGraph(
      setOf([
        resource("aws_security_group", "app", { id: "sg-app", ingress: [], egress: [] }),
        resource("aws_instance", "web", { id: "i", vpc_security_group_ids: ["sg-app"] }),
        resource("aws_db_instance", "db", { identifier: "db", vpc_security_group_ids: ["sg-app"] }),
        resource("aws_lb", "lb", { name: "lb", internal: false, security_groups: ["sg-app"] }),
        resource("aws_lambda_function", "fn", {
          function_name: "fn",
          vpc_config: [{ subnet_ids: [], security_group_ids: ["sg-app"] }],
        }),
      ]),
    );
    for (const target of [
      "aws_instance.web",
      "aws_db_instance.db",
      "aws_lb.lb",
      "aws_lambda_function.fn",
    ]) {
      expect(hasEdge(g, "aws_security_group.app", target, "sg_membership")).toBe(true);
    }
  });

  it("does not add a membership edge for an unresolved (unknown) SG id", () => {
    const g = buildGraph(
      setOf([resource("aws_instance", "web", { id: "i", vpc_security_group_ids: ["sg-missing"] })]),
    );
    expect(edgesByReason(g, "sg_membership")).toHaveLength(0);
  });
});

describe("metadata nodes have no traversal edges", () => {
  it("produces no outgoing edges for IAM or VPC nodes", () => {
    const g = buildGraph(
      setOf([
        resource("aws_iam_role", "r", { name: "r" }),
        resource("aws_iam_policy", "p", { name: "p" }),
        resource("aws_vpc", "v", { id: "vpc-1" }),
      ]),
    );
    expect(g.edges).toHaveLength(0);
  });
});

describe("s3_public_access edges", () => {
  const bucket = () => resource("aws_s3_bucket", "assets", { bucket: "my-assets", id: "my-assets" });
  const pab = (blocked: boolean) =>
    resource("aws_s3_bucket_public_access_block", "assets", {
      bucket: "my-assets",
      block_public_acls: blocked,
      block_public_policy: blocked,
      ignore_public_acls: blocked,
      restrict_public_buckets: blocked,
    });

  it("adds INTERNET -> bucket when the public-access block is relaxed", () => {
    const g = buildGraph(setOf([bucket(), pab(false)]));
    expect(hasEdge(g, INTERNET, "aws_s3_bucket.assets", "s3_public_access")).toBe(true);
  });

  it("adds no edge when the public-access block is fully locked down", () => {
    const g = buildGraph(setOf([bucket(), pab(true)]));
    expect(edgesByReason(g, "s3_public_access")).toHaveLength(0);
  });

  it("adds no edge when there is no public-access block at all (conservative)", () => {
    const g = buildGraph(setOf([bucket()]));
    expect(edgesByReason(g, "s3_public_access")).toHaveLength(0);
  });
});
