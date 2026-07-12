import type { PathDiff } from "../src/graph";

function Stat({ label, count, className }: { label: string; count: number; className: string }) {
  return (
    <div className="text-center">
      <div className={`text-xl font-semibold ${className}`}>{count}</div>
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}

/** Text-only diff counts. Animation of the paths themselves is a later slice. */
export default function DiffSummary({ diff }: { diff: PathDiff }) {
  return (
    <div className="flex gap-5 rounded-lg border border-slate-200 bg-white px-4 py-2">
      <Stat label="New paths" count={diff.added.length} className="text-danger" />
      <Stat label="Closed paths" count={diff.removed.length} className="text-safe" />
      <Stat label="Unchanged" count={diff.unchanged.length} className="text-slate-500" />
    </div>
  );
}
