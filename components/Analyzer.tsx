"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";

import { parsePlan, parsePlanJson } from "../src/parser";
import type { ParseError, ParsedPlan } from "../src/parser";
import { analyzePlan } from "../src/graph";
import type { PlanAnalysis } from "../src/graph";
import { buildCombinedView } from "../lib/combinedView";
import { undeterminedBuckets } from "../lib/undeterminedBuckets";
import { type Demo } from "../lib/demos";
import ScenarioPicker from "./ScenarioPicker";
import FileDrop from "./FileDrop";
import BeforeAfterToggle from "./BeforeAfterToggle";
import NotAnalyzedPanel from "./NotAnalyzedPanel";
import ParseErrorBanner from "./ParseErrorBanner";
import DiffSummary from "./DiffSummary";
import NarrativePanel from "./NarrativePanel";

// React Flow needs the browser; render it client-only.
const GraphView = dynamic(() => import("./GraphView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] items-center justify-center rounded-lg border border-slate-200 bg-white text-sm text-slate-400 sm:h-[560px]">
      Loading graph…
    </div>
  ),
});

type Side = "before" | "after";

export default function Analyzer() {
  const [plan, setPlan] = useState<ParsedPlan | null>(null);
  const [analysis, setAnalysis] = useState<PlanAnalysis | null>(null);
  const [error, setError] = useState<ParseError | null>(null);
  const [side, setSide] = useState<Side>("after");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sourceLabel, setSourceLabel] = useState<string | null>(null);

  const applyResult = (result: ReturnType<typeof parsePlan>, label: string, id: string | null) => {
    setActiveId(id);
    setSourceLabel(label);
    if (!result.ok) {
      setError(result.error);
      setAnalysis(null);
      setPlan(null);
      return;
    }
    setError(null);
    setPlan(result.plan);
    setAnalysis(analyzePlan(result.plan));
    setSide("after");
  };

  const loadDemo = (demo: Demo) => applyResult(parsePlan(demo.plan), demo.label, demo.id);
  const loadText = (text: string, label: string) => applyResult(parsePlanJson(text), label, null);

  const combined = useMemo(() => (analysis ? buildCombinedView(analysis) : null), [analysis]);
  const currentSet = plan ? plan[side] : null;
  const currentUnmodeled = currentSet ? currentSet.unmodeled : [];
  const currentUndetermined = currentSet ? undeterminedBuckets(currentSet) : [];
  // Remount (and re-fit) on a new source, but not on a before/after toggle, so
  // toggling animates the diff instead of re-framing the canvas.
  const sourceKey = activeId ?? sourceLabel ?? "none";
  const noChanges = analysis
    ? analysis.diff.added.length + analysis.diff.removed.length === 0
    : false;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Demo scenarios
          </h2>
          <ScenarioPicker activeId={activeId} onPick={loadDemo} />
        </div>
        <div className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Your own plan
          </h2>
          <FileDrop onLoad={loadText} />
        </div>
      </section>

      {error && <ParseErrorBanner error={error} />}

      {analysis && combined && currentSet && !error && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <BeforeAfterToggle side={side} onChange={setSide} />
              {sourceLabel && <span className="text-sm text-slate-500">{sourceLabel}</span>}
            </div>
            <DiffSummary diff={analysis.diff} />
          </div>
          {noChanges && (
            <p className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500">
              No attack-path changes between the before and after states of this plan.
            </p>
          )}
          <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
            <GraphView key={sourceKey} combined={combined} side={side} resourceSet={currentSet} />
            <NotAnalyzedPanel unmodeled={currentUnmodeled} undetermined={currentUndetermined} />
          </div>
          <p className="text-xs text-slate-400">
            Red edges and nodes lie on an attack path (INTERNET to a data store) in the{" "}
            <span className="font-medium">{side}</span> state. Toggle to compare.
          </p>
          <NarrativePanel analysis={analysis} />
        </section>
      )}

      {!analysis && !error && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm text-slate-500">
            Pick a demo scenario above, or drop your own{" "}
            <span className="font-mono">terraform show -json</span> output.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Everything is parsed in your browser — your plan never leaves your machine.
          </p>
        </div>
      )}
    </div>
  );
}
