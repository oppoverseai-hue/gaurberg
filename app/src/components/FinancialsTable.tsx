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

// Trend line for one row across the periods shown. Missing values break the line; they are never drawn as zero.
function Spark({ values }: { values: (number | null)[] }) {
  const pts = values.map((v, i) => (v == null ? null : [i, v] as const));
  const nums = values.filter((v): v is number => v != null);
  if (nums.length < 2) return <span className="muted">n/a</span>;
  const lo = Math.min(...nums), hi = Math.max(...nums), span = hi - lo || 1, W = 60, H = 18, step = W / Math.max(1, values.length - 1);
  const segs: string[] = []; let cur = "";
  pts.forEach((p) => { if (!p) { if (cur) segs.push(cur); cur = ""; } else cur += `${cur ? "L" : "M"}${(p[0] * step).toFixed(1)} ${(H - ((p[1] - lo) / span) * (H - 2) - 1).toFixed(1)}`; });
  if (cur) segs.push(cur);
  const up = (nums.at(-1) ?? 0) >= nums[0];
  return <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Trend across the periods shown"><path d={segs.join("")} fill="none" stroke={up ? "#4ade80" : "#f87171"} strokeWidth="1.5" /></svg>;
}

export default function FinancialsTable({ fin, marketCap, shares }: { fin: Financials; marketCap: number | null; shares: number | null }) {
  const [tab, setTab] = useState<"is" | "bs" | "cf" | "seg">("is");
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
      <td>{r.label}</td>
      {r.values.map((v, i) => <td key={i} className={`${v == null ? "muted" : ""} ${lbls[i]?.startsWith("LTM") ? "ltm" : ""}`}>{cell(v, r.fmt)}</td>)}
      <td className="trend"><Spark values={r.values} /></td>
    </tr>,
    ...(r.subs ?? []).map((s) => <tr key={r.label + s.label} className="dim"><td>{s.label}</td>{s.values.map((v, i) => <td key={i} className={`${tone(v)} ${lbls[i]?.startsWith("LTM") ? "ltm" : ""}`}>{cell(v, s.fmt)}</td>)}<td /></tr>),
  ]);
  return (
    <>
      <div className="fa-tabs" role="tablist">
        {([["is", "Income statement"], ["bs", "Balance sheet"], ["cf", "Cash flow"], ["seg", "Segments"]] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      <p className="fa-strip mono">Market cap {cell(marketCap, "usd")} (current) · EV {cell(ev, "usd")} (derived: market cap + debt - cash) · Cash {cell(cash, "usd")} · Total debt {cell(debt, "usd")} · Shares {shares == null ? NA : `${(shares / 1e3).toFixed(2)}B`} (latest balance sheet for cash and debt)</p>
      {tab === "seg" ? (
        !seg?.rows.length ? <p className="muted mono" style={{ fontSize: 12 }}>Sample: {seg?.note ?? "segment data is not saved for this company."}</p> : (
          <div className="fa-wrap"><table className="fa">
            <thead><tr><th>{seg.measure}, USD millions</th>{head(seg.columns.map((c) => ({ label: c })))}<th>Trend</th></tr></thead>
            <tbody>{body(seg.rows, seg.columns)}</tbody>
          </table><p className="muted mono" style={{ fontSize: 10, margin: "8px 0 0" }}>{seg.note}</p></div>
        )
      ) : (
        <div className="fa-wrap"><table className="fa">
          <thead><tr><th>USD, millions except EPS</th>{head(cols)}<th>Trend</th></tr></thead>
          <tbody>{body(rows, labels)}</tbody>
        </table>{tab === "bs" && (fin.flags ?? []).map((f) => <p key={f} className="muted mono" style={{ fontSize: 11, color: "#fbbf24", margin: "6px 0 0" }}>⚠ {f}</p>)}</div>
      )}
    </>
  );
}
