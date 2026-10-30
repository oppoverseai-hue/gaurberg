"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { REGIONS, regionShare, hasRegion, regionOf, type CountryRegion, type GeoMap, type GeoRow, buildNodes, pageOf, SIDES, SIDE_LABEL, MAX_PER_SIDE, badgeOf, exposureText, isMapped, viaLabel, TYPE_LABEL, type Co, type LinkType, type MapNode, type Rel, type Side } from "@/lib/graph";
import { exposureWeight, realWeight } from "@/lib/exposure-core";

const GLYPH: Record<string, string> = { b_verified: "✓", b_curated: "◆", b_live: "⚡", b_sample: "○", b_staged: "⚠" };
const glyph = (cls: string) => GLYPH[cls.replace("-", "_")] ?? "";
const ALL_BADGES = [{ label: "Verified", cls: "b-verified" }, { label: "Curated", cls: "b-curated" }, { label: "Live-generated, not reviewed", cls: "b-live" }, { label: "Sample data", cls: "b-sample" }, { label: "Staged, not reviewed", cls: "b-staged" }];
const FILTERS: { key: LinkType; label: string }[] = [{ key: "supplies", label: "Supplies" }, { key: "sells_to", label: "Sells to" }, { key: "competes", label: "Competes" }, { key: "invests", label: "Invests in" }, { key: "acquires", label: "Acquired" }, { key: "partners", label: "Partners" }];

const W = 1200, H = 660, NW = 150, NH = 50;
const FOCAL = { x: W / 2, y: H / 2 };

function slots(side: Side, n: number): { x: number; y: number }[] {
  if (side === "left" || side === "right") {
    const x = side === "left" ? 100 : W - 100;
    return Array.from({ length: n }, (_, i) => ({ x, y: n === 1 ? H / 2 : 140 + (i * (H - 280)) / (n - 1) }));
  }
  const y = side === "top" ? 42 : H - 42;
  return Array.from({ length: n }, (_, i) => ({ x: n === 1 ? W / 2 : 260 + (i * (W - 520)) / (n - 1), y }));
}

// Point on the edge of a node box towards a target, so arrows stop at the box.
function edgePoint(c: { x: number; y: number }, to: { x: number; y: number }, hw: number, hh: number) {
  const dx = to.x - c.x, dy = to.y - c.y;
  const t = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
  return { x: c.x + dx * t, y: c.y + dy * t };
}

type Preview = { company: { name: string; ticker: string; segment: string; size_tier: string }; quote: { price: number; change: number; changePct: number; prevClose: number; high: number; low: number } | null; quoteError: string | null; counts: { suppliers: number; customers: number; partners: number; rivals: number }; about: string | null; news: string | null };

export default function MapView({ focal, rels: allRels, isAdmin, geo = {}, countryRegion = {} }: { focal: Co; rels: Rel[]; isAdmin: boolean; geo?: GeoMap; countryRegion?: CountryRegion }) {
  const router = useRouter();
  const [filter, setFilter] = useState<LinkType | "all">("all");
  // Region filter (M16): keep links whose other company reports revenue in the chosen region. A company with no revenue row is not guessed into any region.
  const [region, setRegion] = useState<string>("all");
  const otherOf = (r: Rel) => (r.source.id === focal.id ? r.target : r.source);
  const regionCounts = useMemo(() => {
    const c: Record<string, number> = {};
    REGIONS.forEach((g) => { const n = allRels.filter((r) => hasRegion(geo[otherOf(r).id], g, countryRegion)).length; if (n) c[g] = n; });
    return c;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRels, geo, countryRegion, focal.id]);
  const rels = useMemo(() => allRels.filter((r) => (filter === "all" || r.relationship_type === filter) && (region === "all" || hasRegion(geo[otherOf(r).id], region, countryRegion))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allRels, filter, region, geo, countryRegion, focal.id]);
  const nodes = useMemo(() => buildNodes(rels, focal.id), [rels, focal.id]);
  // Paging: each side shows MAX_PER_SIDE companies at a time. "List all" opens a searchable list of every company on that side.
  const [pages, setPages] = useState<Record<Side, number>>({ left: 0, right: 0, top: 0, bottom: 0 });
  const [listSide, setListSide] = useState<Side | null>(null);
  const [listQ, setListQ] = useState("");
  useEffect(() => { setPages({ left: 0, right: 0, top: 0, bottom: 0 }); }, [filter, region]);
  // Exposure highlight (GRF-17): fade companies that are not exposed to the focal company (competitors only), and draw line width from
  // the exposed company's own quoted share. Off: width from any quoted figure. A figure missing from its quote never widens a line.
  const [hit, setHit] = useState(false);
  const exposed = (n: MapNode) => n.links.some((r) => r.relationship_type !== "competes");
  const [panel, setPanel] = useState<{ kind: "link"; rel: Rel } | { kind: "company"; co: Co } | null>(null);

  const placed = useMemo(() => {
    const out: { node: MapNode; x: number; y: number }[] = [];
    const info = {} as Record<Side, ReturnType<typeof pageOf>>;
    SIDES.forEach((s) => {
      const pg = pageOf(nodes, s, pages[s]);
      info[s] = pg;
      const sl = slots(s, pg.visible.length);
      pg.visible.forEach((n, i) => out.push({ node: n, ...sl[i] }));
    });
    return { out, info };
  }, [nodes, pages]);
  const pickFromList = (side: Side, i: number, n: MapNode) => { setPages((p) => ({ ...p, [side]: Math.floor(i / MAX_PER_SIDE) })); setPanel({ kind: "company", co: n.co }); };

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && setPanel(null);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  const tally = allRels.reduce<Record<string, { cls: string; n: number }>>((a, r) => { const b = badgeOf(r); a[b.label] = { cls: b.cls, n: (a[b.label]?.n ?? 0) + 1 }; return a; }, {});

  return (
    <div className="mapshell">
      <div className="mapbar">
        <div className="crumb">
          <Link href={`/company/${focal.ticker}`}>← Back to company page</Link><span className="muted">|</span>
          <strong>{focal.name}</strong><span className="tag">{focal.ticker}</span><span>/</span><span>Ecosystem map</span><span className="muted">|</span>
          <Link href={`/company/${focal.ticker}/exposure`}>Who is exposed to {focal.name} →</Link>
        </div>
        <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {Object.entries(tally).map(([k, v]) => <span key={k} className={`badge ${v.cls}`}><span aria-hidden>{glyph(v.cls)}</span>{k}: {v.n}</span>)}
        </span>
      </div>
      <div className="filters">
        <div className="pills" role="group" aria-label="Filter by relationship type">
          <span className="label" style={{ marginRight: 4 }}>Filter</span>
          <button className={`fpill ${filter === "all" ? "on" : ""}`} onClick={() => setFilter("all")}>All ({allRels.length})</button>
          {FILTERS.map((f) => { const n = allRels.filter((r) => r.relationship_type === f.key).length; return n === 0 ? null : (
            <button key={f.key} className={`fpill ${filter === f.key ? "on" : ""}`} onClick={() => setFilter(f.key)}>{f.label} ({n})</button>
          ); })}
        </div>
        {(Object.keys(regionCounts).length > 0 || (geo[focal.id] ?? []).length > 0) && (
          <div className="pills" role="group" aria-label="Filter by region where the other company earns revenue">
            <span className="label" style={{ marginRight: 4 }}>Region</span>
            <button className={`fpill ${region === "all" ? "on" : ""}`} onClick={() => setRegion("all")}>All regions</button>
            {REGIONS.filter((g) => regionCounts[g]).map((g) => (
              <button key={g} className={`fpill ${region === g ? "on" : ""}`} onClick={() => setRegion(g)}>{g} ({regionCounts[g]})</button>
            ))}
            {Object.keys(regionCounts).length === 0 && <span className="muted" style={{ fontSize: 12 }}>No other company on this map has reported revenue by region yet.</span>}
          </div>
        )}
        <div className="legend">
          <span><svg width="22" height="8"><line x1="0" y1="4" x2="14" y2="4" stroke="var(--accent)" strokeWidth="2" /><polygon points="14,0 22,4 14,8" fill="var(--accent)" /></svg>Supplies / invests / acquired</span>
          <span><svg width="22" height="8"><line x1="0" y1="4" x2="22" y2="4" stroke="var(--fg2)" strokeWidth="1.5" strokeDasharray="4 4" /></svg>Competes</span>
          <span><svg width="22" height="8"><line x1="0" y1="4" x2="22" y2="4" stroke="#60a5fa" strokeWidth="1.5" /></svg>Partners</span>
          <span className="muted">{hit ? `Thicker line = larger stated share of the exposed company` : "Thicker line = larger disclosed size (figure found in the saved quote)"}</span>
          <button className={`fpill ${hit ? "on" : ""}`} onClick={() => setHit(!hit)} aria-pressed={hit}>Highlight exposure</button>
        </div>
      </div>
      <div className="mapbody">
        <div className="canvas">
          <div className="info">{rels.length} links, {nodes.length} companies<small>Left: into {focal.name} · Right: out of it · Above: competitors · Below: partners</small></div>
        <svg viewBox={`0 0 ${W} ${H}`} className="map" role="img" aria-label={`Ecosystem map of ${focal.name}`}>
          <defs>
            <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--accent)" /></marker>
          </defs>
          {placed.out.map(({ node, x, y }) => node.links.map((r, k) => {
            const toFocal = r.target.id === focal.id;
            const directed = r.relationship_type !== "competes" && r.relationship_type !== "partners";
            const a = toFocal || !directed ? { x, y } : FOCAL, b = toFocal || !directed ? FOCAL : { x, y };
            const off = (k - (node.links.length - 1) / 2) * 14;
            const p1 = edgePoint(a, b, a === FOCAL ? 86 : NW / 2, a === FOCAL ? 34 : NH / 2);
            const p2 = edgePoint(b, a, b === FOCAL ? 86 : NW / 2, b === FOCAL ? 34 : NH / 2);
            const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
            const nx = -(p2.y - p1.y), ny = p2.x - p1.x, len = Math.hypot(nx, ny) || 1;
            const cx = mx + (nx / len) * off * 4, cy = my + (ny / len) * off * 4;
            const sel = panel?.kind === "link" && panel.rel.id === r.id;
            const w = hit ? exposureWeight(r, focal.id) : realWeight(r);
            const lw = w != null ? 1.5 + Math.min(w, 100) / 25 : 1.5;
            return (
              <g key={r.id} className={`link ${sel ? "sel" : ""} ${isMapped(node.co) ? "" : "dim"} ${hit && r.relationship_type === "competes" ? "fade" : ""}`} onClick={() => setPanel({ kind: "link", rel: r })} tabIndex={0} role="button"
                 aria-label={`${r.source.name} ${TYPE_LABEL[r.relationship_type]} ${r.target.name}`} onKeyDown={(e) => e.key === "Enter" && setPanel({ kind: "link", rel: r })}>
                <path d={`M${p1.x},${p1.y} Q${cx},${cy} ${p2.x},${p2.y}`} className="hit" />
                <path d={`M${p1.x},${p1.y} Q${cx},${cy} ${p2.x},${p2.y}`} className={`line ${r.relationship_type === "competes" ? "dash" : r.relationship_type === "partners" ? "plain" : ""}`} strokeWidth={lw} markerEnd={directed ? "url(#arr)" : undefined} />
                {(directed || sel) && <text x={(p1.x + 2 * cx + p2.x) / 4} y={(p1.y + 2 * cy + p2.y) / 4 - 4} className="lbl" textAnchor="middle">{TYPE_LABEL[r.relationship_type]}</text>}
              </g>
            );
          }))}
          <g className="focal"><rect x={FOCAL.x - 86} y={FOCAL.y - 34} width={172} height={68} rx={10} /><text x={FOCAL.x} y={FOCAL.y - 14} textAnchor="middle" className="fl">FOCAL ENTITY</text><text x={FOCAL.x} y={FOCAL.y + 5} textAnchor="middle" className="fn">{focal.name}</text><text x={FOCAL.x} y={FOCAL.y + 22} textAnchor="middle" className="ft">{focal.ticker}</text></g>
          {placed.out.map(({ node, x, y }) => {
            const m = isMapped(node.co);
            const sel = panel?.kind === "company" && panel.co.id === node.co.id;
            return (
              <g key={node.co.id} className={`node ${m ? "" : "unmapped"} ${sel ? "sel" : ""} ${hit && !exposed(node) ? "fade" : ""}`} onClick={() => setPanel({ kind: "company", co: node.co })} tabIndex={0} role="button"
                 aria-label={`${node.co.name}${m ? "" : ", not yet mapped"}`} onKeyDown={(e) => e.key === "Enter" && setPanel({ kind: "company", co: node.co })}>
                <rect x={x - NW / 2} y={y - NH / 2} width={NW} height={NH} rx={8} />
                <text x={x} y={y - 2} textAnchor="middle" className="nn">{(() => { const v = viaLabel(node), t = v ? `${node.co.name} (${v})` : node.co.name; return t.length > 22 ? t.slice(0, 21) + "…" : t; })()}</text>
                {m && <text x={x} y={y + 14} textAnchor="middle" className="nt">{node.co.ticker}{region !== "all" ? (() => { const sh = regionShare(geo[node.co.id], region, countryRegion); return sh != null ? ` · ${sh}% ${region}` : ""; })() : ""}</text>}
                {!m && <text x={x} y={y + 14} textAnchor="middle" className="nt">Not yet mapped{region !== "all" ? (() => { const sh = regionShare(geo[node.co.id], region, countryRegion); return sh != null ? ` · ${sh}% ${region}` : ""; })() : ""}</text>}
              </g>
            );
          })}
        </svg>
        </div>
        <aside className="side">
          {panel?.kind === "link" && <LinkPanel rel={panel.rel} onClose={() => setPanel(null)} />}
          {panel?.kind === "company" && <CompanyPane co={panel.co} focal={focal} geo={geo[panel.co.id]} countryRegion={countryRegion} onClose={() => setPanel(null)} onRecenter={(t) => router.push(`/map/${t}`)} />}
          {!panel && <div className="empty">Select a link to see what the filings say, or a company to preview it.</div>}
          <div className="sidefoot"><kbd>Esc</kbd><span>closes this pane</span></div>
        </aside>
      </div>
      <div className="more">
        {SIDES.filter((s) => placed.info[s].total > MAX_PER_SIDE).map((s) => {
          const g = placed.info[s];
          const go = (p: number) => setPages({ ...pages, [s]: p });
          return (
            <div key={s} className="pager" role="group" aria-label={`Page through ${SIDE_LABEL[s].toLowerCase()}`}>
              <span className="pg-label">{SIDE_LABEL[s]}</span>
              <span className="pg-range">Batch {g.page + 1} of {g.pages} · {g.from}–{g.to} of {g.total}</span>
              <button className="chip" disabled={g.page === 0} onClick={() => go(g.page - 1)}>◂ Prev {MAX_PER_SIDE}</button>
              <button className="chip" disabled={g.page >= g.pages - 1} onClick={() => go(g.page + 1)}>Next {MAX_PER_SIDE} ▸</button>
              <button className={`chip ${listSide === s ? "on" : ""}`} aria-expanded={listSide === s} onClick={() => { setListSide(listSide === s ? null : s); setListQ(""); }}>{listSide === s ? "Hide list" : `List all ${g.total}`}</button>
            </div>
          );
        })}
      </div>
      {listSide && placed.info[listSide].total > MAX_PER_SIDE && (
        <CohortList side={listSide} all={placed.info[listSide].all} page={placed.info[listSide].page} q={listQ} onQ={setListQ} onPick={(i, n) => pickFromList(listSide, i, n)} onClose={() => setListSide(null)} selId={panel?.kind === "company" ? panel.co.id : null} />
      )}
    </div>
  );
}

function CohortList({ side, all, page, q, onQ, onPick, onClose, selId }: { side: Side; all: MapNode[]; page: number; q: string; onQ: (v: string) => void; onPick: (i: number, n: MapNode) => void; onClose: () => void; selId: number | null }) {
  const needle = q.trim().toLowerCase();
  const rows = all.map((n, i) => ({ n, i })).filter(({ n }) => !needle || n.co.name.toLowerCase().includes(needle) || (n.co.ticker ?? "").toLowerCase().includes(needle));
  return (
    <div className="cohort" role="region" aria-label={`All ${SIDE_LABEL[side].toLowerCase()}`}>
      <div className="cohort-h">
        <strong>{SIDE_LABEL[side]} · {all.length}</strong>
        <input type="search" value={q} onChange={(e) => onQ(e.target.value)} placeholder="Search by name or ticker…" aria-label="Search this list" />
        <button className="chip" onClick={onClose}>Close</button>
      </div>
      <div className="cohort-scroll">
        <table>
          <thead><tr><th>#</th><th>Company</th><th>Link</th><th>Size</th><th>Batch</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="muted">No match in this list.</td></tr>}
            {rows.map(({ n, i }) => {
              const sized = n.links.find((l) => l.exposure_pct != null) ?? n.links[0];
              const b = Math.floor(i / MAX_PER_SIDE);
              return (
                <tr key={n.co.id} className={`${b === page ? "cur" : ""} ${selId === n.co.id ? "sel" : ""}`} tabIndex={0} onClick={() => onPick(i, n)} onKeyDown={(e) => e.key === "Enter" && onPick(i, n)}>
                  <td className="mono">{i + 1}</td>
                  <td>{n.co.name}{n.co.ticker ? <span className="tag" style={{ marginLeft: 6 }}>{n.co.ticker}</span> : <span className="muted"> · no ticker</span>}</td>
                  <td>{[...new Set(n.links.map((l) => TYPE_LABEL[l.relationship_type]))].join(", ")}</td>
                  <td className="muted">{exposureText(sized)}</td>
                  <td className="mono">{b + 1}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Badge({ rel }: { rel: Rel }) { const b = badgeOf(rel); return <span className={`badge ${b.cls}`}><span aria-hidden>{glyph(b.cls)}</span>{b.label}</span>; }

type Headline = { item: { headline: string; source: string; ts: number; url: string } | null; note: string | null };
function HeadlineLine({ co }: { co: Co }) {
  const [h, setH] = useState<Headline | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    setH(null); setErr(false);
    if (!co.ticker) return;
    fetch(`/api/headline/${co.ticker}`).then((r) => (r.ok ? r.json() : Promise.reject())).then(setH).catch(() => setErr(true));
  }, [co.ticker]);
  if (!co.ticker) return <div className="r"><span>{co.name}</span><span className="muted">Not listed, no news feed</span></div>;
  const day = h?.item ? new Date(h.item.ts * 1000).toISOString().slice(0, 10) : "";
  return (
    <div className="r"><span>{co.name}</span>
      <span>{err ? <span className="warn">News unavailable</span> : !h ? <span className="muted">Loading…</span> : h.item
        ? <Link href={`/company/${co.ticker}#news`}>{h.item.headline} <span className="muted">· {h.item.source} · {day}</span></Link>
        : <span className="muted">{h.note}</span>}</span>
    </div>
  );
}

function LinkPanel({ rel, onClose }: { rel: Rel; onClose: () => void }) {
  const active = badgeOf(rel).label;
  return (
    <div className="panel">
      <button className="x" onClick={onClose} aria-label="Close">×</button>
      <div>
        <div className="kicker"><span>Disclosed relationship</span></div>
        <h3 style={{ marginTop: 4 }}><span className="em">{rel.source.name}</span> {TYPE_LABEL[rel.relationship_type]} <span className="em">{rel.target.name}</span></h3>
      </div>
      <div className="trust">
        <span className="label">Trust and review status</span>
        <div className="set">
          {[...ALL_BADGES].sort((a, b) => (b.label === active ? 1 : 0) - (a.label === active ? 1 : 0)).map((b) => (
            <span key={b.label} className={`badge ${b.cls} ${b.label === active ? "active" : ""}`}><span aria-hidden>{glyph(b.cls)}</span>{b.label}{b.label === active && <span style={{ marginLeft: "auto", fontSize: 9, textTransform: "uppercase" }}>This link</span>}</span>
          ))}
        </div>
      </div>
      <div className="attrs">
        <div className="h">Disclosed attributes</div>
        <div className="r"><span>Size</span><span>{exposureText(rel)}</span></div>
        <div className="r"><span>Confidence</span><span className={rel.confidence == null ? "warn" : ""}>{rel.confidence == null ? "Not scored yet" : rel.confidence.toFixed(2)}</span></div>
        <div className="r"><span>As of</span><span>{rel.as_of_date ?? "Date not given"}</span></div>
        <div className="r"><span>Kind of source</span><span>{rel.source_type === "sec_filing" ? "SEC filing (10-K or 20-F)" : rel.source_type === "annual_report" ? "Company annual report" : rel.source_type ?? "Not given"}</span></div>
      </div>
      <div>
        <div className="sub"><span>Evidence</span></div>
        {rel.evidence.length === 0 ? <p className="muted">No source quote saved for this link.</p> : rel.evidence.map((e, i) => (
          <blockquote key={i}>
            “{e.quote}”
            <footer>{e.section ? `${e.section.replace("_", " ")} · ` : ""}{e.published_at ? `filed ${e.published_at} · ` : ""}{e.quote_found ? "quote found word for word · " : ""}
              {e.document_url && <a href={e.document_url} target="_blank" rel="noreferrer">View source ↗</a>}</footer>
          </blockquote>
        ))}
      </div>
      <div className="attrs">
        <div className="h">Latest news, last 7 days</div>
        <HeadlineLine co={rel.source} />
        <HeadlineLine co={rel.target} />
      </div>
      <div className="disc">Shows a disclosed relationship, not a prediction. The panel shows what the sources say. It does not say a news item or price move caused a link.</div>
    </div>
  );
}

function GeoBlock({ rows, cr }: { rows?: GeoRow[]; cr: CountryRegion }) {
  if (!rows || rows.length === 0) return <p className="muted mono" style={{ fontSize: 11, margin: "8px 0 0" }}>Revenue by region: not reported in a source we have read.</p>;
  const unit = rows[0].unit ? ` ${rows[0].unit}` : "";
  return (
    <div className="attrs">
      <div className="h">Revenue by region · year to {rows[0].period_end}{rows.some((g) => g.status !== "promoted" && g.status !== "live") ? " · staged, not reviewed" : ""}</div>
      {rows.map((g, i) => <div className="r" key={i}><span>{g.label}{regionOf(g, cr) ? <span className="muted"> · {regionOf(g, cr)}</span> : <span className="warn"> · region not mapped</span>}</span><span>{g.revenue_pct != null ? `${g.revenue_pct}%` : "n/a"}{g.revenue_amount != null ? ` (${g.currency ?? ""}${g.revenue_amount.toLocaleString()}${unit})` : ""}</span></div>)}
    </div>
  );
}

function CompanyPane({ co, focal, onClose, onRecenter, geo, countryRegion }: { co: Co; focal: Co; onClose: () => void; onRecenter: (t: string) => void; geo?: GeoRow[]; countryRegion: CountryRegion }) {
  const mapped = isMapped(co);
  const [data, setData] = useState<Preview | null>(null);
  const [err, setErr] = useState(false);
  const [n, setN] = useState(0);
  useEffect(() => {
    setData(null); setErr(false);
    if (!mapped || !co.ticker) return;
    fetch(`/api/preview/${co.ticker}`).then((r) => (r.ok ? r.json() : Promise.reject())).then(setData).catch(() => setErr(true));
  }, [co.ticker, mapped, n]);
  const q = data?.quote;
  return (
    <div className="panel">
      <button className="x" onClick={onClose} aria-label="Close">×</button>
      <div>
        <div className="kicker"><span>Company</span></div>
        <h3 style={{ marginTop: 4 }}>{co.name} {co.ticker && <span className="tag">{co.ticker}</span>}</h3>
      </div>
      <GeoBlock rows={geo} cr={countryRegion} />
      {!mapped ? (
        <p className="muted">{co.entity_type === "group" ? "A group with no stock ticker." : "This company is not yet mapped."} The map shows only what {focal.name}'s filings say about it.</p>
      ) : err ? (
        <p>Could not load this company. <button className="chip" onClick={() => setN(n + 1)}>Retry</button></p>
      ) : !data ? <p className="muted">Loading…</p> : (
        <div className="pv">
          {q ? (
            <div className="price">${q.price.toFixed(2)} <span className={`pill ${q.change >= 0 ? "up" : "down"}`}>{q.change >= 0 ? "+" : ""}{q.change.toFixed(2)} ({q.changePct.toFixed(2)}%)</span></div>
          ) : <p className="muted">Data unavailable: {data.quoteError}</p>}
          {q && <p className="muted mono" style={{ fontSize: 11, margin: "6px 0 0" }}>Prev close {q.prevClose.toFixed(2)} · Day range {q.low.toFixed(2)} to {q.high.toFixed(2)}</p>}
          <p className="muted mono" style={{ fontSize: 11, margin: "4px 0 0" }}>{data.company.segment} · {data.company.size_tier} cap</p>
          <div className="counts"><div><b>{data.counts.suppliers}</b>Suppliers</div><div><b>{data.counts.customers}</b>Customers</div><div><b>{data.counts.partners}</b>Partners</div><div><b>{data.counts.rivals}</b>Rivals</div></div>
          <p className="muted mono" style={{ fontSize: 11, margin: "0 0 12px" }}>About: {data.about ? data.about.split(/(?<=\.)\s/).slice(0, 2).join(" ") : "not available yet"}<br />Latest news: not available right now</p>
          <div className="actions">
            <Link className="chip" href={`/company/${co.ticker}`}>Open full page</Link>
            {co.id !== focal.id && <button className="chip" onClick={() => onRecenter(co.ticker!)}>Recenter map here</button>}
          </div>
        </div>
      )}
    </div>
  );
}
