"use client";
// Who is exposed as a matrix (GRF-19, GRF-17, UX-4). Chart: each linked company with a measured price pattern at (correlation, beta)
// of its daily returns against the focal company, coloured by its map group. Table: every linked company, points or not, with the
// stated reason for a missing pattern. Chips filter both and carry the map's counts. Selecting a company fills the side panel.
// Plain SVG; every number comes from the server (comove-core, reaction-core, stored rows).
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { SIDES, SIDE_LABEL, type Side } from "@/lib/graph";
import { axisDomain, ticks, type MatrixPoint } from "@/lib/exposure-core";
import { possessive } from "@/lib/about-core";

export type MatrixCo = {
  id: number; name: string; ticker: string | null; href: string | null; group: boolean; place: Side;
  point: MatrixPoint | null; reason: string | null; next: string | null; sources: { label: string; url: string | null }[];
  links: { text: string; share: string | null; badge: string | null; quotes: { quote: string; url: string | null; section: string | null; filed: string | null }[]; url: string | null }[];
  moves: { quarter: string; date: string; pct: number | null; note: string }[];
};

const COLOR: Record<Side, string> = { left: "var(--xm-into)", right: "var(--xm-out)", both: "var(--xm-both)", top: "var(--xm-comp)", bottom: "var(--xm-part)" };
const W = 640, H = 400, L = 52, R = 16, T = 16, B = 44;
const day = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const f2 = (n: number) => n.toFixed(2);
type Sort = { key: "name" | "corr" | "beta"; dir: 1 | -1 };

export default function ExposureMatrix({ focal, cos, counts }: { focal: string; cos: MatrixCo[]; counts: Record<Side, number> }) {
  const [only, setOnly] = useState<Side | "all">("all");
  const [view, setView] = useState<"chart" | "table">("chart");
  const [sel, setSel] = useState<number | null>(null);
  const [sort, setSort] = useState<Sort>({ key: "corr", dir: -1 });
  const panel = useRef<HTMLElement>(null);
  const shown = useMemo(() => cos.filter((c) => only === "all" || c.place === only), [cos, only]);
  const points = shown.filter((c) => c.point);
  const xd = axisDomain(points.map((c) => c.point!.corr), 0.2), yd = axisDomain(points.map((c) => c.point!.beta), 0.25);
  const x = (v: number) => L + ((v - xd[0]) / (xd[1] - xd[0])) * (W - L - R), y = (v: number) => H - B - ((v - yd[0]) / (yd[1] - yd[0])) * (H - T - B);
  const pick = (id: number) => {
    setSel((s) => (s === id ? null : id));
    // On a phone the panel sits above the table: bring it into view.
    if (window.matchMedia("(max-width: 600px)").matches) requestAnimationFrame(() => panel.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  useEffect(() => { if (sel != null && !shown.some((c) => c.id === sel)) setSel(null); }, [shown, sel]);
  const rows = useMemo(() => [...shown].sort((a, b) => {
    if (sort.key === "name") return sort.dir * a.name.localeCompare(b.name);
    const va = a.point?.[sort.key], vb = b.point?.[sort.key];
    if (va == null && vb == null) return a.name.localeCompare(b.name);
    if (va == null) return 1; if (vb == null) return -1; // companies with no pattern always sort last
    return sort.dir * (va - vb);
  }), [shown, sort]);
  const th = (key: Sort["key"], label: string) => (
    <th aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button type="button" className="xm-sort" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === "name" ? 1 : -1 }))}>
        {label}{sort.key === key ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
      </button>
    </th>
  );
  const picked = cos.find((c) => c.id === sel) ?? null;
  const total = cos.length;
  return (
    <div className="xm">
      <div className="xm-bar">
        <div className="pills" role="group" aria-label="Filter by map group">
          <button type="button" className={`fpill ${only === "all" ? "on" : ""}`} aria-pressed={only === "all"} onClick={() => setOnly("all")}>All ({total})</button>
          {SIDES.filter((s) => counts[s] > 0).map((s) => (
            <button key={s} type="button" className={`fpill ${only === s ? "on" : ""}`} aria-pressed={only === s} onClick={() => setOnly(s)}>
              <span className="xm-dot" style={{ background: COLOR[s] }} aria-hidden />{SIDE_LABEL[s]} ({counts[s]})
            </button>
          ))}
        </div>
        <div className="pills xm-toggle" role="group" aria-label="View">
          <button type="button" className={`fpill ${view === "chart" ? "on" : ""}`} aria-pressed={view === "chart"} onClick={() => setView("chart")}>Chart</button>
          <button type="button" className={`fpill ${view === "table" ? "on" : ""}`} aria-pressed={view === "table"} onClick={() => setView("table")}>Table</button>
        </div>
      </div>
      <div className="xm-body">
        <div className="xm-main">
          <div className={`xm-chartwrap ${view === "chart" ? "" : "xm-off"}`}>
            <svg viewBox={`0 0 ${W} ${H}`} className="xm-chart" role="group" aria-label={`Linked companies by correlation and beta of daily returns with ${focal}`}>
              {ticks(xd, 0.2).map((t) => <g key={`x${t}`}><line x1={x(t)} x2={x(t)} y1={T} y2={H - B} className={t === 0 ? "xm-zero" : "xm-grid"} /><text x={x(t)} y={H - B + 14} textAnchor="middle" className="xm-tick">{t.toFixed(1)}</text></g>)}
              {ticks(yd, 0.25).map((t) => <g key={`y${t}`}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className={t === 0 ? "xm-zero" : "xm-grid"} /><text x={L - 6} y={y(t) + 3} textAnchor="end" className="xm-tick">{t.toFixed(2)}</text></g>)}
              <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle" className="xm-axis">Correlation of daily returns with {focal}</text>
              <text transform={`translate(12 ${(T + H - B) / 2}) rotate(-90)`} textAnchor="middle" className="xm-axis">Beta: move per 1% of {focal}</text>
              {points.map((c) => (
                <g key={c.id} role="button" tabIndex={0} className={`xm-pt ${sel === c.id ? "sel" : ""}`} aria-pressed={sel === c.id}
                   aria-label={`${c.name}: correlation ${f2(c.point!.corr)}, beta ${f2(c.point!.beta)}`}
                   onClick={() => pick(c.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(c.id); } }}>
                  <circle cx={x(c.point!.corr)} cy={y(c.point!.beta)} r={7} style={{ fill: COLOR[c.place] }} />
                  <text x={x(c.point!.corr) + 10} y={y(c.point!.beta) + 4} className="xm-lbl">{c.ticker ?? c.name}</text>
                </g>
              ))}
            </svg>
            <p className="xm-note">Measured price pattern, last 12 months. Not a disclosed size and not a prediction.
              {" "}{points.length} of {shown.length} linked {shown.length === 1 ? "company" : "companies"} plotted; the rest are in the table with the reason.</p>
          </div>
          <div className={`xm-tablewrap ${view === "table" ? "" : "xm-off xm-phone-on"}`}>
            <div className="rx-scroll">
              <table className="rx xm-table">
                <thead><tr>{th("name", "Company")}<th>Links to {focal}</th>{th("corr", "Correlation")}{th("beta", "Beta")}<th>Next report</th></tr></thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id} className={sel === c.id ? "sel" : ""}>
                      <td>
                        <button type="button" className="xm-name" aria-pressed={sel === c.id} onClick={() => pick(c.id)}>
                          <span className="xm-dot" style={{ background: COLOR[c.place] }} aria-hidden />{c.name}
                        </button>
                        {c.ticker && <span className="xtk">{c.ticker}</span>}{c.group && <span className="tag">Group</span>}
                        <div className="xm-src">{c.sources.map((s, i) => <span key={s.label}>{i ? " · " : ""}{s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.label} ↗</a> : s.label}</span>)}</div>
                      </td>
                      <td className="xm-kinds">{c.links.map((l) => l.text).join("; ")}{c.links.some((l) => l.badge) && <> <span className="badge b-live">{c.links.find((l) => l.badge)!.badge}</span></>}</td>
                      {c.point ? <><td className="mono">{f2(c.point.corr)}</td><td className="mono">{f2(c.point.beta)}</td></>
                        : <td colSpan={2} className="xm-na"><span className="mono">n/a</span> <small>{c.reason}</small></td>}
                      <td className="mono">{c.next ? day(c.next) : <span className="muted">not known</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <aside ref={panel} className="xm-panel" aria-live="polite">
          {!picked ? <p className="muted">Select a company in the chart or the table to see its links, measured pattern and evidence.</p> : (
            <>
              <h3>{picked.href ? <Link href={picked.href}>{picked.name}</Link> : picked.name} {picked.ticker && <span className="tag">{picked.ticker}</span>}</h3>
              <p className="xm-kv"><span className="xm-dot" style={{ background: COLOR[picked.place] }} aria-hidden />{SIDE_LABEL[picked.place]}</p>
              <ul className="xm-links">{picked.links.map((l, i) => <li key={i}>{l.text}{l.badge && <> <span className="badge b-live">{l.badge}</span></>}</li>)}</ul>
              <dl className="xm-dl">
                {picked.point ? <>
                  <div><dt>Correlation</dt><dd className="mono">{f2(picked.point.corr)}</dd></div>
                  <div><dt>Beta (move per 1% of {focal})</dt><dd className="mono">{f2(picked.point.beta)}</dd></div>
                  <div><dt>Shared trading days used</dt><dd className="mono">{picked.point.days}</dd></div>
                </> : <div><dt>Price pattern</dt><dd>n/a: {picked.reason}</dd></div>}
                <div><dt>Next report</dt><dd className="mono">{picked.next ? day(picked.next) : "not known"}</dd></div>
              </dl>
              {picked.moves.length > 0 && (
                <>
                  <p className="label">Moves on {possessive(focal)} report days</p>
                  <ul className="xm-moves">{picked.moves.map((m) => (
                    <li key={m.date}><span>{m.quarter}, {day(m.date)}</span>
                      {m.pct != null ? <span className={`mono ${m.pct >= 0 ? "up" : "down"}`}>{m.pct >= 0 ? "+" : ""}{m.pct.toFixed(1)}% <small className="muted">({m.note})</small></span> : <span className="muted mono">n/a <small>({m.note})</small></span>}</li>
                  ))}</ul>
                </>
              )}
              <p className="label">Evidence</p>
              {picked.links.map((l, i) => (
                <div key={i} className="xm-ev">
                  <p className="xm-evh">{l.text}</p>
                  {l.share && <p className="xtext">{l.share}</p>}
                  {l.quotes.length ? l.quotes.map((q, j) => (
                    <blockquote key={j}>“{q.quote}”<footer>{q.section ? `${/^p\d+$/.test(q.section) ? `page ${q.section.slice(1)}` : q.section.replace(/_/g, " ")} · ` : ""}{q.filed ? `filed ${q.filed} · ` : ""}{q.url ? <a href={q.url} target="_blank" rel="noreferrer">Filing ↗</a> : "no filing link saved"}</footer></blockquote>
                  )) : l.url ? <p className="muted"><a href={l.url} target="_blank" rel="noreferrer">Filing ↗</a></p> : <p className="muted">No quote or filing link saved.</p>}
                </div>
              ))}
              {picked.href && <p><Link href={picked.href}>Open {picked.name}&apos;s page →</Link></p>}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
