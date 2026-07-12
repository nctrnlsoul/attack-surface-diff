# Attack-Surface Diff

Drop a Terraform plan, watch your attack surface change.

It parses a Terraform plan JSON, computes the declared attack-path graph before
and after, and renders an animated diff where newly exposed paths glow red, with
a plain-English risk narrative per path.

> Honest-claims scope: this models **declared reachability from your Terraform
> plan**, not a pentest, vulnerability scan, or runtime security check. It
> reflects what the IaC declares, not what is live.

## Status

Week 1 engine complete: parser + graph, 62 tests. `src/parser` turns
`terraform show -json` into a typed, fail-closed resource model; `src/graph`
builds the declared-reachability attack graph, runs BFS from a synthetic
INTERNET node to data stores, and diffs the before/after path sets. Pure
functions, no framework coupling. Visualization and the AI narrative come in
later slices.

## The parser core

`src/parser` is a pure TypeScript module with no network, file, or environment
access. It runs the same in a browser (the plan JSON never leaves the machine)
as in a test.

```ts
import { parsePlanJson } from "./src/parser/index.js";

const result = parsePlanJson(rawTerraformShowJson);
if (!result.ok) {
  // Fail closed: a clear typed error, never a silent partial result.
  console.error(result.error.code, result.error.message, result.error.path);
} else {
  const { before, after } = result.plan;
  // before / after each hold typed `resources` plus an `unmodeled` list.
}
```

### Fail-closed contract

Unparseable or unknown-shaped input produces a clear typed error and no partial
result. A resource whose *type* is valid but not modeled is collected into an
`unmodeled` list, never dropped. This is the fail-closed lesson from prior
builds: refuse bad input loudly, do not silently render a partial graph.

### Modeled AWS resource types

Security groups and rules, EC2, ALB/NLB (`aws_lb`), RDS, S3 buckets and their
public-access config, Lambda, API Gateway, VPC / subnet / route tables, and IAM
roles and policies (as node metadata only).

## Develop

```bash
npm install
npm test
npm run typecheck
```

## License

MIT. See [LICENSE](./LICENSE).
