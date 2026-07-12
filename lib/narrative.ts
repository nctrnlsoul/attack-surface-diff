// Shared contract between the client (which builds path summaries) and the server
// route (which turns them into sentences). Pure: no network, no SDK, no secret.
//
// This DTO is deliberately minimal — it is the ONLY data that leaves the browser.
// It carries resource addresses, types, and edge reasons/ports from the changed
// paths, and nothing from the plan file itself.

export interface PathNodeRef {
  /** Terraform address, e.g. "aws_db_instance.prod" or "INTERNET". */
  address: string;
  /** Node kind, e.g. "db_instance", "security_group", "internet". */
  type: string;
}

export interface PathHop {
  /** Edge reason, e.g. "internet_ingress", "sg_membership". */
  reason: string;
  /** Short port/protocol detail if any, e.g. "tcp 5432". */
  detail: string | null;
}

export interface PathSummary {
  kind: "added" | "removed";
  /** Ordered nodes, INTERNET first, data store last. */
  nodes: PathNodeRef[];
  /** Reason/detail for each consecutive hop. */
  hops: PathHop[];
}

// Honest-claims: the model must describe DECLARED reachability, never claim a live
// test/scan/assessment. The forbidden literal phrases (pentest / vulnerability scan
// / runtime security) are deliberately NOT written here — the constraint is stated
// conceptually so the prompt itself stays clean.
export const NARRATIVE_SYSTEM = [
  "You write one short, plain-English risk sentence for each attack path in a",
  "Terraform plan diff. An attack path is a chain of declared reachability from the",
  "public internet to a data store.",
  "",
  "Rules:",
  "- Describe only DECLARED reachability from the Terraform plan: what the",
  "  infrastructure-as-code declares, not what is live or running. You are reading a",
  "  plan file, not observing a real system.",
  "- Do not describe this as testing, auditing, or assessing a live system, and do",
  "  not use alarmist security-audit jargon. State plainly what the change exposes or",
  "  closes.",
  '- For an "added" path: say which data store becomes reachable from the internet,',
  "  through which resources, and on which port if given. Example: \"This change",
  "  exposes RDS aws_db_instance.prod to the internet through security group",
  '  aws_security_group.web on TCP 5432, as declared in the plan."',
  '- For a "removed" path: say which previously reachable data store is now closed off.',
  "- Exactly one sentence per path. Name resources by the addresses and types given.",
  '- Return ONLY a JSON object, no prose and no markdown fences:',
  '  {"sentences": ["...", "..."]} with one string per input path, in the same order.',
].join("\n");

/** Build the user message from summaries only. No plan data can reach here. */
export function buildUserPayload(summaries: PathSummary[]): string {
  return [
    "Write one risk sentence per path below. The paths are given as JSON.",
    JSON.stringify({ paths: summaries }),
  ].join("\n\n");
}

// Server-side belt-and-suspenders for the honest-claims rule: even though the
// system prompt forbids them, a generated sentence containing one of these is
// dropped rather than shown.
const FORBIDDEN_CLAIMS = ["pentest", "vulnerability scan", "runtime security"];

export function containsForbiddenClaim(text: string): boolean {
  const lower = text.toLowerCase();
  return FORBIDDEN_CLAIMS.some((phrase) => lower.includes(phrase));
}
