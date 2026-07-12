# Attack-Surface Diff

Drop a Terraform plan, watch your attack surface change.

Attack-Surface Diff reads a `terraform show -json` plan, builds the declared
internet-to-data-store reachability graph for the before and after states, and
renders an animated diff: paths that open glow red, paths that close fade green.
Turn on the optional AI layer and each changed path gets one plain-English risk
sentence.

## What it models (and what it does not)

It models **declared reachability from your Terraform plan**: what your
infrastructure-as-code declares, not what is live or running. It reads a plan file
and reasons about the configuration in it. It does not connect to AWS, does not
observe a running environment, and has no ground truth to be wrong about beyond
the plan you give it.

Scope: AWS, one plan file (which carries both `prior_state` = before and
`planned_values` = after). It models 14 resource types (security groups and rules,
EC2, ALB/NLB, RDS, S3 buckets and their public-access config, Lambda, API Gateway,
VPC / subnet / route tables, and IAM roles and policies as node metadata). An
attack path is a chain from a synthetic INTERNET node to a data store (RDS or S3).

## How it works

```
terraform show -json                     (your plan, parsed in the browser)
        |
        v
  parser  (src/parser)      typed, fail-closed resource model
        |
        v
  graph engine (src/graph)  INTERNET node + declared-reachability edges
        |                   -> bounded-DFS attack paths -> before/after diff
        v
  React Flow view           animated diff: added paths glow red, closed fade green
        |
        v  (optional, opt-in)
  /api/narrative            server route -> Claude Haiku -> one sentence per path
```

- **Parser** (`src/parser`): pure TypeScript, no network / file / env access. Turns
  the plan JSON into a typed model. Fail-closed: unparseable or unknown-shaped input
  returns a clear typed error, never a silent partial graph. A valid resource type
  the model does not cover is collected into an `unmodeled` list, never dropped.
- **Graph engine** (`src/graph`): builds nodes and declared-reachability edges
  (0.0.0.0/0 ingress, security-group references and membership, S3 public access),
  runs a bounded DFS from INTERNET to data stores, and diffs the before/after path
  sets. `analyzePlan(plan)` is the single entry point. Pure functions.
- **View**: React Flow with animated re-layout on the before/after toggle. Honors
  `prefers-reduced-motion` and falls back to a static diff.
- **AI narrative** (optional): a server route sends only minimal path summaries to
  Claude and returns one sentence per changed path.

## Privacy and security

- **Your plan never leaves the browser.** Parsing and the whole graph run
  client-side. Nothing is uploaded.
- **The AI narrative is opt-in and default off.** When you turn it on, the only
  thing sent to the server route is a minimal summary of each changed path (resource
  addresses, types, and ports). The plan file itself is never sent, and a visible
  line states exactly what is sent.
- **The Anthropic key is server-side only.** It is read from the `ANTHROPIC_API_KEY`
  environment variable inside the API route, never bundled to the client, never
  logged. With no key configured, the AI section is hidden and the rest of the app
  works fully.
- A secret-safety audit of the working tree and the full git history found no key
  material committed.

## Quickstart

```bash
npm install
npm run dev        # http://localhost:3000
```

The three demo scenarios work with zero setup. The AI narrative is optional. To
enable it, put your Anthropic API key in a local `.env.local` (git-ignored):

```
ANTHROPIC_API_KEY=your-key-here
```

The app is fully usable without a key (the AI section simply stays hidden).

```bash
npm test           # 105 tests
npm run build      # production build
npm run typecheck
```

## Demo scenarios

1. **SG opened to 0.0.0.0/0**: a security group is opened to the internet, exposing
   RDS through the web tier. One new path.
2. **S3 bucket made public**: a bucket's public-access block is relaxed. One new
   path. A second bucket with no public-access block shows as "public access not
   determined" (neither exposed nor safe), because the plan gives no basis to judge
   it.
3. **Fix PR closes a path**: a fix restricts a database security group, closing an
   existing exposure. One closed path.

You can also drop your own `terraform show -json` output.

## Tests

105 tests across 11 files. The engine (62: 37 parser, 25 graph) is heavily unit
tested, including the fail-closed / malformed-input case. The pure UI helpers (43)
cover layout, the diff view model, the path summaries (with a test that the AI
payload carries no plan data), and the honest-claims scrub.

```bash
npm test
```

## Stack

Next.js (App Router) + TypeScript + Tailwind + React Flow, with Claude Haiku for
the optional narrative. No database.

## License

MIT. See [LICENSE](./LICENSE).
