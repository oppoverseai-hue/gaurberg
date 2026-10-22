"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MARKETS, MARKET_LABEL, type Market, buildNodes, shown, badgeOf, exposureText, isMapped, viaLabel, TYPE_LABEL, type Co, type LinkType, type MapNode, type Rel, type Side } from "@/lib/graph";

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

export default function MapView({ focal, rels: allRels, isAdmin }: { focal: Co; rels: Rel[]; isAdmin: boolean }) {
  const router = useRouter();
  const [filter, setFilter] = useState<LinkType | "all">("all");
  // Market filter: a link belongs to the market(s) of the company on its other end. "unknown" = that company's listing is not yet recorded.
  const [market, setMarket] = useState<string>("all");
  const marketsOf = (r: Rel): string[] => { const o = r.source.id === focal.id ? r.target : r.source; return o.markets && o.markets.length ? o.markets : ["unknown"]; };
  const marketCounts = useMemo(() => {
    const c: Record<string, number> = {};
    allRels.forEach((r) => marketsOf(r).forEach((m) => { c[m] = (c[m] ?? 0) + 1; }));
    return c;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRels, focal.id]);
  const rels = useMemo(() => allRels.filter((r) => (filter === "all" || r.relationship_type === filter) && (market === "all" || marketsOf(r).includes(market))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allRels, filter, market, focal.id]);
  const nodes = useMemo(() => buildNodes(rels, focal.id), [rels, focal.id]);
  const [expanded, setExpanded] = useState<Record<Side, boolean>>({ left: false, right: false, top: false, bottom: false });
  const [panel, setPanel] = useState<{ kind: "link"; rel: Rel } | { kind: "company"; co: Co } | null>(null);

  const placed = useMemo(() => {
    const out: { node: MapNode; x: number; y: number }[] = [];
    const hidden: Record<Side, number> = { left: 0, right: 0, top: 0, bottom: 0 };
    (["left", "right", "top", "bottom"] as Side[]).forEach((s) => {
      const { visible, hidden: h } = shown(nodes, s, expanded[s]);
      hidden[s] = h;
      const sl = slots(s, visible.length);
      visible.forEach((n, i) => out.push({ node: n, ...sl[i] }));
    });
    return { out, hidden };
  }, [nodes, expanded]);

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
          <strong>{focal.name}</strong><span className="tag">{focal.ticker}</span><span>/</span><span>Ecosystem map</span>
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
        {Object.keys(marketCounts).some((m) => m !== "US" && m !== "unknown") && (
          <div className="pills" role="group" aria-label="Filter by market of the other company">
            <span className="label" style={{ marginRight: 4 }}>Market</span>
            <button className={`fpill ${market === "all" ? "on" : ""}`} onClick={() => setMarket("all")}>All markets</button>
            {[...MARKETS, "unknown"].filter((m) => marketCounts[m]).map((m) => (
              <button key={m} className={`fpill ${market === m ? "on" : ""}`} onClick={() => setMarket(m)}>{m === "unknown" ? "Not yet known" : MARKET_LABEL[m as Market]} ({marketCounts[m]})</button>
            ))}
          </div>
        )}
        <div className="legend">
          <span><svg width="22" height="8"><line x1="0" y1="4" x2="14" y2="4" stroke="var(--accent)" strokeWidth="2" /><polygon points="14,0 22,4 14,8" fill="var(--accent)" /></svg>Supplies / invests / acquired</span>
          <span><svg width="22" height="8"><line x1="0" y1="4" x2="22" y2="4" stroke="var(--fg2)" strokeWidth="1.5" strokeDasharray="4 4" /></svg>Competes</span>
          <span><svg width="22" height="8"><line x1="0" y1="4" x2="22" y2="4" stroke="#60a5fa" strokeWidth="1.5" /></svg>Partners</span>
          <span className="muted">Thicker line = larger disclosed size</span>
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
            const lw = r.exposure_pct != null ? 1.5 + Math.min(r.exposure_pct, 100) / 25 : 1.5;
            return (
              <g key={r.id} className={`link ${sel ? "sel" : ""} ${isMapped(node.co) ? "" : "dim"}`} onClick={() => setPanel({ kind: "link", rel: r })} tabIndex={0} role="button"
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
              <g key={node.co.id} className={`node ${m ? "" : "unmapped"} ${sel ? "sel" : ""}`} onClick={() => setPanel({ kind: "company", co: node.co })} tabIndex={0} role="button"
                 aria-label={`${node.co.name}${m ? "" : ", not yet mapped"}`} onKeyDown={(e) => e.key === "Enter" && setPanel({ kind: "company", co: node.co })}>
                <rect x={x - NW / 2} y={y - NH / 2} width={NW} height={NH} rx={8} />
                <text x={x} y={y - 2} textAnchor="middle" className="nn">{(() => { const v = viaLabel(node), t = v ? `${node.co.name} (${v})` : node.co.name; return t.length > 22 ? t.slice(0, 21) + "…" : t; })()}</text>
                {m && <text x={x} y={y + 14} textAnchor="middle" className="nt">{node.co.ticker}</text>}
                {!m && <text x={x} y={y + 14} textAnchor="middle" className="nt">Not yet mapped</text>}
              </g>
            );
          })}
        </svg>
        </div>
        <aside className="side">
          {panel?.kind === "link" && <LinkPanel rel={panel.rel} onClose={() => setPanel(null)} />}
          {panel?.kind === "company" && <CompanyPane co={panel.co} focal={focal} onClose={() => setPanel(null)} onRecenter={(t) => router.push(`/map/${t}`)} />}
          {!panel && <div className="empty">Select a link to see what the filings say, or a company to preview it.</div>}
          <div className="sidefoot"><kbd>Esc</kbd><span>closes this pane</span></div>
        </aside>
      </div>
      <div className="more">
        {(["left", "right", "top", "bottom"] as Side[]).filter((s) => placed.hidden[s] > 0 || expanded[s]).map((s) => (
          <button key={s} className="chip" onClick={() => setExpanded({ ...expanded, [s]: !expanded[s] })}>
            {expanded[s] ? `Show fewer on the ${s}` : `Show ${placed.hidden[s]} more on the ${s}`}
          </button>
        ))}
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

function CompanyPane({ co, focal, onClose, onRecenter }: { co: Co; focal: Co; onClose: () => void; onRecenter: (t: string) => void }) {
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
