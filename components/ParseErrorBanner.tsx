import type { ParseError } from "../src/parser";

/** Fail-closed UI: a clear typed error, and no graph. Mirrors the parser contract. */
export default function ParseErrorBanner({ error }: { error: ParseError }) {
  return (
    <div role="alert" className="rounded-lg border border-danger/40 bg-danger/5 p-4">
      <div className="flex items-center gap-2 font-semibold text-danger">
        <span aria-hidden className="text-lg">
          &#9888;
        </span>
        <span>Could not parse this plan</span>
      </div>
      <p className="mt-2 text-sm text-slate-700">{error.message}</p>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-slate-500">
        <dt className="font-medium">Code</dt>
        <dd className="font-mono">{error.code}</dd>
        <dt className="font-medium">Where</dt>
        <dd className="font-mono">{error.path}</dd>
      </dl>
      <p className="mt-3 text-xs text-slate-500">
        Nothing was rendered. The parser fails closed: it refuses unknown-shaped input rather than
        showing a partial graph.
      </p>
    </div>
  );
}
