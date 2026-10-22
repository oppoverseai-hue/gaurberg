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
const tone = (v: number | null) => (v == null ? "" : v < 0 ? "neg" : "pos");

// Bars for one line across the columns shown. Missing values are left as gaps, never drawn as zero.
function RowChart({ row, labels }: { row: FinRow; labels: string[] }) {
  const vals = row.values, max = Math.max(1e-9, ...vals.map((v) => Math.abs(v ?? 0)));
  const W = 100 / vals.length;
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" style={{ width: "100%", height: 90 }} role="img" aria-label={`${row.label} by period`}>
      <line x1="0" x2="100" y1="20" y2="20" stroke="var(--line)" strokeWidth=".3" />
      {vals.map((v, i) => v == null ? null : (
        <rect key={i} x={i * W + W * 0.2} width={W * 0.6} y={v >= 0 ? 20 - (v / max) * 18 : 20} height={Math.max(0.4, (Math.abs(v) / max) * 18)} fill={v >= 0 ? "var(--accent)" : "#f87171"}><title>{labels[i]}: {cell(v, row.fmt)}</title></rect>
      ))}
    </svg>
  );
}

export default function FinancialsTable({ fin, marketCap }: { fin: Financials; marketCap: number | null }) {
  const [tab, setTab] = useState<"is" | "bs" | "cf" | "seg">("is");
  const [open, setOpen] = useState<string | null>(null);
  const cols = fin.columns ?? [];
  const labels = cols.map((c) => c.label);
  const seg = fin.segments ?? null;
  const rows = tab === "seg" ? [] : (fin[tab] ?? []);
  // EV is derived from today's market cap and the latest balance sheet: market cap + total debt - cash. It is shown only when all three exist.
  const last = (r?: FinRow) => r?.values.at(-1) ?? null;
  const debt = last(fin.bs?.find((r) => r.label.startsWith("Total debt"))), cash = last(fin.bs?.find((r) => r.label.startsWith("Cash")));
  const ev = marketCap != null && debt != null && cash != null ? marketCap + debt - cash : null;
  const head = (lbls: { label: string; kind?: string }[]) => lbls.map((c) => <th key={c.label} className={c.kind === "LTM" ? "ltm" : ""}>{c.label}</th>);
  const body = (rs: FinRow[], lbls: string[]) => rs.flatMap((r) => [
    <tr key={r.label}>
      <td>{r.label}<button className={`fa-chart ${open === r.label ? "on" : ""}`} aria-label={`Chart ${r.label}`} aria-expanded={open === r.label} onClick={() => setOpen(open === r.label ? null : r.label)}>▥</button></td>
      {r.values.map((v, i) => <td key={i} className={`${v == null ? "muted" : ""} ${lbls[i]?.startsWith("LTM") ? "ltm" : ""}`}>{cell(v, r.fmt)}</td>)}
    </tr>,
    ...(open === r.label ? [<tr key={r.label + "g"} className="fa-graph"><td colSpan={r.values.length + 1}><RowChart row={r} labels={lbls} /></td></tr>] : []),
    ...(r.subs ?? []).map((s) => <tr key={r.label + s.label} className="dim"><td>{s.label}</td>{s.values.map((v, i) => <td key={i} className={`${tone(v)} ${lbls[i]?.startsWith("LTM") ? "ltm" : ""}`}>{cell(v, s.fmt)}</td>)}</tr>),
  ]);
  return (
    <>
      <div className="fa-tabs" role="tablist">
        {([["is", "Income statement"], ["bs", "Balance sheet"], ["cf", "Cash flow"], ["seg", "Segments"]] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => { setTab(k); setOpen(null); }}>{l}</button>
        ))}
      </div>
      {tab === "bs" && <p className="fa-strip mono">Market cap {cell(marketCap, "usd")} (current) · Enterprise value {cell(ev, "usd")} (derived: market cap + debt - cash)</p>}
      {tab === "seg" ? (
        !seg?.rows.length ? <p className="muted mono" style={{ fontSize: 12 }}>Sample: {seg?.note ?? "segment data is not saved for this company."}</p> : (
          <div className="fa-wrap"><table className="fa">
            <thead><tr><th>{seg.measure}, USD millions</th>{head(seg.columns.map((c) => ({ label: c })))}</tr></thead>
            <tbody>{body(seg.rows, seg.columns)}</tbody>
          </table><p className="muted mono" style={{ fontSize: 10, margin: "8px 0 0" }}>{seg.note}</p></div>
        )
      ) : (
        <div className="fa-wrap"><table className="fa">
          <thead><tr><th>USD, millions except EPS</th>{head(cols)}</tr></thead>
          <tbody>{body(rows, labels)}</tbody>
        </table>{tab === "bs" && (fin.flags ?? []).map((f) => <p key={f} className="muted mono" style={{ fontSize: 11, color: "#fbbf24", margin: "6px 0 0" }}>⚠ {f}</p>)}</div>
      )}
    </>
  );
}
