import type { UnmodeledResource } from "../src/parser";

/**
 * Coverage notes: what the tool did NOT fully judge from the plan.
 * - unmodeled: valid resource types with no reachability model in v1.
 * - undetermined: S3 buckets with no declared public-access block, so their
 *   internet exposure can't be judged — shown as neither exposed nor safe.
 */
export default function NotAnalyzedPanel({
  unmodeled,
  undetermined,
}: {
  unmodeled: UnmodeledResource[];
  undetermined: string[];
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-700">Not analyzed</h2>

      <div className="mt-3">
        <h3 className="text-xs font-semibold text-slate-600">
          Unmodeled resources <span className="text-slate-400">({unmodeled.length})</span>
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Valid resources with no declared-reachability model in v1. Shown, never dropped.
        </p>
        {unmodeled.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">Every resource in this view was modeled.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {unmodeled.map((r) => (
              <li key={r.address} className="flex items-start justify-between gap-3 text-sm">
                <span title={r.address} className="min-w-0 break-all font-mono text-slate-700">
                  {r.address}
                </span>
                <span className="shrink-0 font-mono text-xs text-slate-400">{r.type}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {undetermined.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <h3 className="text-xs font-semibold text-slate-600">
            Public access not determined <span className="text-slate-400">({undetermined.length})</span>
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            No public-access block is declared for these buckets, so their internet exposure can&apos;t
            be judged from the plan — treated as neither exposed nor safe.
          </p>
          <ul className="mt-2 space-y-1">
            {undetermined.map((address) => (
              <li key={address} className="min-w-0 break-all font-mono text-sm text-slate-700">
                {address}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
