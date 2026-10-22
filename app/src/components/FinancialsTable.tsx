"use client";
import { useState } from "react";
import type { Financials, FinRow } from "@/lib/financials";

const NA = "n/a";
function cell(v: number | null, fmt: FinRow["fmt"]) {
  if (v == null) return NA;
  if (fmt === "pct") return `${v.toFixed(1)}%`;
  if (fmt === "eps") return v.toFixed(2);
  const a = Math.abs(v), s = v < 0 ? "-" : "";
  return a >= 1e3 ? `${s}${(a / 1e3).toFixed(2)}B` : `${s}${a.toFixed(0)}M`;
}

export default function FinancialsTable({ fin, marketCap }: { fin: Financials; marketCap: number | null }) {
  const [tab, setTab] = useState<"is" | "bs" | "cf">("is");
  const cols = fin.columns ?? [];
  const rows = fin[tab] ?? [];
  // EV is derived from today's market cap and the latest balance sheet: market cap + total debt - cash. It is shown only when all three exist.
  const last = (r?: FinRow) => r?.values.at(-1) ?? null;
  const debt = last(fin.bs?.find((r) => r.label.startsWith("Total debt"))), cash = last(fin.bs?.find((r) => r.label.startsWith("Cash")));
  const ev = marketCap != null && debt != null && cash != null ? marketCap + debt - cash : null;
  return (
    <>
      <div className="fa-tabs" role="tablist">
        {([["is", "Income statement"], ["bs", "Balance sheet"], ["cf", "Cash flow"]] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === "bs" && (
        <p className="fa-strip mono">Market cap {cell(marketCap, "usd")} (current) · Enterprise value {cell(ev, "usd")} (derived: market cap + debt - cash)</p>
      )}
      <div className="fa-wrap">
        <table className="fa">
          <thead><tr><th>USD, millions except EPS</th>{cols.map((c) => <th key={c.label}>{c.label}</th>)}</tr></thead>
          <tbody>
            {rows.flatMap((r) => [
              <tr key={r.label}><td>{r.label}</td>{r.values.map((v, i) => <td key={i} className={v == null ? "muted" : ""}>{cell(v, r.fmt)}</td>)}</tr>,
              ...(r.subs ?? []).map((s) => <tr key={r.label + s.label} className="dim"><td>{s.label}</td>{s.values.map((v, i) => <td key={i}>{cell(v, s.fmt)}</td>)}</tr>),
            ])}
          </tbody>
        </table>
      </div>
    </>
  );
}
