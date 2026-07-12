import { DEMOS, type Demo } from "../lib/demos";

export default function ScenarioPicker({
  activeId,
  onPick,
}: {
  activeId: string | null;
  onPick: (demo: Demo) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {DEMOS.map((demo) => (
        <button
          key={demo.id}
          type="button"
          onClick={() => onPick(demo)}
          title={demo.description}
          className={`max-w-[240px] rounded-lg border px-3 py-2 text-left text-sm transition ${
            activeId === demo.id
              ? "border-brand bg-brand/5 text-brand-dark"
              : "border-slate-200 bg-white hover:border-brand/50"
          }`}
        >
          <span className="font-medium">{demo.label}</span>
        </button>
      ))}
    </div>
  );
}
