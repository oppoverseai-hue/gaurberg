"use client";
// One filter row. A change submits the form, so there is no Apply button to forget.
import { useRef } from "react";

type Opt = { v: string; l: string };
// regions (TRM-12 comps view) adds a region filter; showDir=false hides the 1-month change filter, which only the price view uses.
export default function FilterBar({ values, markets, segments, sizes, hidden, regions, regionLabel = "All regions", showDir = true }: { values: Record<string, string>; markets: Opt[]; segments: Opt[]; sizes: Opt[]; hidden: Record<string, string>; regions?: Opt[]; regionLabel?: string; showDir?: boolean }) {
  const form = useRef<HTMLFormElement>(null);
  const sel = (name: string, all: string, opts: Opt[]) => (
    <select name={name} defaultValue={values[name] ?? ""} aria-label={all} onChange={() => form.current?.requestSubmit()}>
      <option value="">{all}</option>{opts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
  return (
    <form ref={form} method="get" className="scr-filters">
      {Object.entries(hidden).map(([k, v]) => v ? <input key={k} type="hidden" name={k} value={v} /> : null)}
      {sel("market", "All markets", markets)}
      {regions && sel("region", regionLabel, regions)}
      {sel("segment", "All segments", segments)}
      {sel("size", "All sizes", sizes)}
      {showDir && sel("dir", "Any 1-month change", [{ v: "up", l: "Up over 1 month" }, { v: "down", l: "Down over 1 month" }])}
      <noscript><button className="btn">Apply</button></noscript>
      <a href={"/screener?" + new URLSearchParams(Object.entries({ scope: hidden.scope === "viewed" ? "viewed" : "", view: hidden.view ?? "" }).filter(([, v]) => v)).toString()} className="mono scr-reset">Reset</a>
    </form>
  );
}
