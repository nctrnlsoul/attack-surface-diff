type Side = "before" | "after";

export default function BeforeAfterToggle({
  side,
  onChange,
}: {
  side: Side;
  onChange: (side: Side) => void;
}) {
  const sides: Side[] = ["before", "after"];
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
      {sides.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          aria-pressed={side === s}
          className={`rounded-md px-4 py-1.5 text-sm capitalize transition ${
            side === s ? "bg-brand text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
