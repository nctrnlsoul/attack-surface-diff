import type { UnmodeledResource } from "../src/parser";

/** Lists valid resources with no reachability model in v1. Shown, never dropped. */
export default function NotAnalyzedPanel({ unmodeled }: { unmodeled: UnmodeledResource[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-700">
        Not analyzed <span className="text-slate-400">({unmodeled.length})</span>
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Valid resources with no declared-reachability model in v1. Shown, never dropped.
      </p>
      {unmodeled.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">Every resource in this view was modeled.</p>
      ) : (
        <ul className="mt-3 space-y-1">
          {unmodeled.map((r) => (
            <li key={r.address} className="flex justify-between gap-3 text-sm">
              <span className="truncate font-mono text-slate-700">{r.address}</span>
              <span className="shrink-0 font-mono text-xs text-slate-400">{r.type}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
