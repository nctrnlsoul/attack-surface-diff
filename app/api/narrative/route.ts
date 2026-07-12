// AI narrative route — the ONLY place the Anthropic key and SDK are used. Runs
// server-side only; Next never bundles a route handler into the client, so neither
// the key nor the SDK can reach the browser.
//
// Security posture: read the key from process.env only; never log the key, the
// request body, or the response; rebuild the prompt from typed summary fields only
// (a tampered client cannot smuggle extra content to the model); fail closed to a
// generic error, never a crash and never a leak.

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

import {
  NARRATIVE_SYSTEM,
  buildUserPayload,
  containsForbiddenClaim,
  type PathHop,
  type PathNodeRef,
  type PathSummary,
} from "../../../lib/narrative";

export const runtime = "nodejs";

const MAX_PATHS = 50;

/** Availability signal only — a boolean, never the secret itself. */
export function GET() {
  return NextResponse.json({ available: Boolean(process.env.ANTHROPIC_API_KEY) });
}

function toNodeRefs(value: unknown): PathNodeRef[] {
  if (!Array.isArray(value)) return [];
  const out: PathNodeRef[] = [];
  for (const n of value) {
    if (n && typeof n === "object") {
      const rec = n as Record<string, unknown>;
      const address = typeof rec.address === "string" ? rec.address : "";
      const type = typeof rec.type === "string" ? rec.type : "";
      if (address) out.push({ address, type });
    }
  }
  return out;
}

function toHops(value: unknown): PathHop[] {
  if (!Array.isArray(value)) return [];
  const out: PathHop[] = [];
  for (const h of value) {
    if (h && typeof h === "object") {
      const rec = h as Record<string, unknown>;
      const reason = typeof rec.reason === "string" ? rec.reason : "unknown";
      const detail = typeof rec.detail === "string" ? rec.detail : null;
      out.push({ reason, detail });
    }
  }
  return out;
}

/** Rebuild ONLY the known summary fields; ignore anything else the client sent. */
function normalizeSummaries(body: unknown): PathSummary[] {
  if (!body || typeof body !== "object") return [];
  const raw = (body as Record<string, unknown>).summaries;
  if (!Array.isArray(raw)) return [];
  const out: PathSummary[] = [];
  for (const item of raw.slice(0, MAX_PATHS)) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const kind = rec.kind === "added" || rec.kind === "removed" ? rec.kind : null;
    if (kind === null) continue;
    out.push({ kind, nodes: toNodeRefs(rec.nodes), hops: toHops(rec.hops) });
  }
  return out;
}

function extractSentences(text: string): string[] | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as { sentences?: unknown };
    if (!Array.isArray(parsed.sentences)) return null;
    return parsed.sentences.filter((s): s is string => typeof s === "string");
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ available: false }, { status: 200 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const summaries = normalizeSummaries(body);
  if (summaries.length === 0) {
    return NextResponse.json({ sentences: [] });
  }

  try {
    const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment
    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      system: NARRATIVE_SYSTEM,
      messages: [{ role: "user", content: buildUserPayload(summaries) }],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    const sentences =
      textBlock && textBlock.type === "text" ? extractSentences(textBlock.text) : null;
    // Fail closed: reject a wrong-count reply (would mislabel paths) or any
    // sentence that breaks the honest-claims rule. Better no narrative than a
    // wrong or overclaiming one.
    if (
      sentences === null ||
      sentences.length !== summaries.length ||
      sentences.some(containsForbiddenClaim)
    ) {
      return NextResponse.json({ error: "Could not generate a narrative." });
    }
    return NextResponse.json({ sentences });
  } catch {
    // Never surface the key or internal error detail.
    return NextResponse.json({ error: "Narrative service unavailable." });
  }
}
