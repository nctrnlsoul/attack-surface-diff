"use client";

import { useEffect, useMemo, useState } from "react";

import type { PlanAnalysis } from "../src/graph";
import { buildPathSummaries } from "../lib/pathSummary";

type Status = "idle" | "loading" | "error";

export default function NarrativePanel({ analysis }: { analysis: PlanAnalysis }) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [sentences, setSentences] = useState<string[] | null>(null);
  const [status, setStatus] = useState<Status>("idle");

  const summaries = useMemo(() => buildPathSummaries(analysis), [analysis]);

  // Availability check: never sends anything, just asks whether a key is configured.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/narrative")
      .then((r) => r.json())
      .then((data: { available?: boolean }) => {
        if (!cancelled) setAvailable(Boolean(data.available));
      })
      .catch(() => {
        if (!cancelled) setAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Reset when a new plan is analyzed (privacy-first: default back to off).
  useEffect(() => {
    setEnabled(false);
    setSentences(null);
    setStatus("idle");
  }, [analysis]);

  // Only when the user opts in do the summaries leave the browser.
  useEffect(() => {
    if (!enabled) return;
    if (summaries.length === 0) {
      setSentences([]);
      return;
    }
    let cancelled = false;
    setStatus("loading");
    fetch("/api/narrative", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ summaries }),
    })
      .then((r) => r.json())
      .then((data: { sentences?: unknown }) => {
        if (cancelled) return;
        if (Array.isArray(data.sentences)) {
          setSentences(data.sentences.filter((s): s is string => typeof s === "string"));
          setStatus("idle");
        } else {
          setStatus("error");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, summaries]);

  // No key configured, or nothing to narrate → the panel is simply absent.
  if (available !== true || summaries.length === 0) return null;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-700">AI risk narrative</h2>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled((v) => !v)}
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition ${
            enabled ? "border-brand bg-brand/10 text-brand-dark" : "border-slate-300 text-slate-500"
          }`}
        >
          <span
            aria-hidden
            className={`h-3 w-3 rounded-full ${enabled ? "bg-brand" : "bg-slate-300"}`}
          />
          {enabled ? "On" : "Off"}
        </button>
      </div>

      <p className="mt-2 text-xs text-slate-500">
        Off by default. When on, only the resource names, types, and ports from the changed paths
        are sent to Anthropic to write these sentences. Your Terraform plan never leaves your
        browser.
      </p>

      {enabled && (
        <div className="mt-3">
          {status === "loading" && <p className="text-sm text-slate-400">Generating…</p>}
          {status === "error" && (
            <p className="text-sm text-slate-400">Narrative unavailable. Try again.</p>
          )}
          {status === "idle" && sentences && sentences.length === 0 && (
            <p className="text-sm text-slate-400">No changed paths to describe.</p>
          )}
          {status === "idle" && sentences && sentences.length > 0 && (
            <ul className="space-y-3">
              {summaries.map((summary, i) => {
                const dataStore = summary.nodes[summary.nodes.length - 1]?.address ?? "";
                const label = summary.kind === "added" ? "New path" : "Closed path";
                const sentence = sentences[i];
                if (sentence === undefined) return null;
                return (
                  <li key={`${summary.kind}-${dataStore}-${i}`} className="text-sm">
                    <span
                      className={`font-medium ${
                        summary.kind === "added" ? "text-danger" : "text-safe"
                      }`}
                    >
                      {label} → <span className="font-mono">{dataStore}</span>
                    </span>
                    <p className="mt-0.5 text-slate-600">{sentence}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
