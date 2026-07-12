// Server-rendered landing hero. Static copy only — honest-claims wording
// (declared reachability, not a live check); NorthSchema brand accent.
const CHIPS = ["Parsed in your browser", "AWS", "Declared reachability"];

export default function Hero() {
  return (
    <header className="mx-auto max-w-6xl px-4 pb-2 pt-10">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand">NorthSchema</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
        Attack-Surface <span className="text-brand">Diff</span>
      </h1>
      <p className="mt-2 max-w-2xl text-base text-slate-600">
        Drop a Terraform plan and watch your attack surface change. It maps the declared reachability
        from the public internet to your data stores, before and after, and highlights the paths that
        open (red) or close (green).
      </p>
      <p className="mt-1 max-w-2xl text-sm text-slate-500">
        It reflects what your infrastructure-as-code declares, not a live environment.
      </p>
      <ul className="mt-4 flex flex-wrap gap-2 text-xs">
        {CHIPS.map((chip) => (
          <li
            key={chip}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600"
          >
            {chip}
          </li>
        ))}
      </ul>
    </header>
  );
}
