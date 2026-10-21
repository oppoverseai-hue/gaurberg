"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buildNodes, shown, badgeOf, exposureText, isMapped, TYPE_LABEL, type Co, type MapNode, type Rel, type Side } from "@/lib/graph";

const W = 1200, H = 660, NW = 150, NH = 46;
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

export default function MapView({ focal, rels, isAdmin }: { focal: Co; rels: Rel[]; isAdmin: boolean }) {
  const router = useRouter();
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

  const tally = rels.reduce<Record<string, number>>((a, r) => { const b = badgeOf(r).label; a[b] = (a[b] ?? 0) + 1; return a; }, {});

  return (
    <div className="mapwrap">
      <div className="maptop">
        <span className="muted">{rels.length} links, {nodes.length} companies. Left: into {focal.name}. Right: out of it. Above: competitors. Below: partners.</span>
        <span className="badges">{Object.entries(tally).map(([k, v]) => <span key={k} className={`badge ${k.startsWith("Staged") ? "b-staged" : ""}`}>{k}: {v}</span>)}</span>
      </div>
      {!isAdmin && null}
      <div className="mapbody">
        <svg viewBox={`0 0 ${W} ${H}`} className="map" role="img" aria-label={`Ecosystem map of ${focal.name}`}>
          <defs>
            <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--accent)" /></marker>
          </defs>
          {placed.out.map(({ node, x, y }) => node.links.map((r, k) => {
            const toFocal = r.target.id === focal.id;
            const directed = r.relationship_type !== "competes" && r.relationship_type !== "partners";
            const a = toFocal || !directed ? { x, y } : FOCAL, b = toFocal || !directed ? FOCAL : { x, y };
            const off = (k - (node.links.length - 1) / 2) * 14;
            const p1 = edgePoint(a, b, a === FOCAL ? 86 : NW / 2, a === FOCAL ? 30 : NH / 2);
            const p2 = edgePoint(b, a, b === FOCAL ? 86 : NW / 2, b === FOCAL ? 30 : NH / 2);
            const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
            const nx = -(p2.y - p1.y), ny = p2.x - p1.x, len = Math.hypot(nx, ny) || 1;
            const cx = mx + (nx / len) * off * 4, cy = my + (ny / len) * off * 4;
            const sel = panel?.kind === "link" && panel.rel.id === r.id;
            const lw = r.exposure_pct != null ? 1.5 + Math.min(r.exposure_pct, 100) / 25 : 1.5;
            return (
              <g key={r.id} className={`link ${sel ? "sel" : ""} ${isMapped(node.co) ? "" : "dim"}`} onClick={() => setPanel({ kind: "link", rel: r })} tabIndex={0} role="button"
                 aria-label={`${r.source.name} ${TYPE_LABEL[r.relationship_type]} ${r.target.name}`} onKeyDown={(e) => e.key === "Enter" && setPanel({ kind: "link", rel: r })}>
                <path d={`M${p1.x},${p1.y} Q${cx},${cy} ${p2.x},${p2.y}`} className="hit" />
                <path d={`M${p1.x},${p1.y} Q${cx},${cy} ${p2.x},${p2.y}`} className={`line ${r.relationship_type === "competes" ? "dash" : ""}`} strokeWidth={lw} markerEnd={directed ? "url(#arr)" : undefined} />
                {(directed || sel) && <text x={(p1.x + 2 * cx + p2.x) / 4} y={(p1.y + 2 * cy + p2.y) / 4 - 4} className="lbl" textAnchor="middle">{TYPE_LABEL[r.relationship_type]}</text>}
              </g>
            );
          }))}
          <g className="focal"><rect x={FOCAL.x - 86} y={FOCAL.y - 30} width={172} height={60} rx={10} /><text x={FOCAL.x} y={FOCAL.y - 2} textAnchor="middle" className="fn">{focal.name}</text><text x={FOCAL.x} y={FOCAL.y + 16} textAnchor="middle" className="ft">{focal.ticker}</text></g>
          {placed.out.map(({ node, x, y }) => {
            const m = isMapped(node.co);
            const sel = panel?.kind === "company" && panel.co.id === node.co.id;
            return (
              <g key={node.co.id} className={`node ${m ? "" : "unmapped"} ${sel ? "sel" : ""}`} onClick={() => setPanel({ kind: "company", co: node.co })} tabIndex={0} role="button"
                 aria-label={`${node.co.name}${m ? "" : ", not yet mapped"}`} onKeyDown={(e) => e.key === "Enter" && setPanel({ kind: "company", co: node.co })}>
                <rect x={x - NW / 2} y={y - NH / 2} width={NW} height={NH} rx={8} />
                <text x={x} y={m ? y - 1 : y + 4} textAnchor="middle" className="nn">{node.co.name.length > 22 ? node.co.name.slice(0, 21) + "…" : node.co.name}</text>
                {m && <text x={x} y={y + 14} textAnchor="middle" className="nt">{node.co.ticker}</text>}
                {!m && <title>{`${node.co.name}: not yet mapped`}</title>}
              </g>
            );
          })}
        </svg>
        <aside className={`side ${panel ? "open" : ""}`}>
          {panel?.kind === "link" && <LinkPanel rel={panel.rel} onClose={() => setPanel(null)} />}
          {panel?.kind === "company" && <CompanyPane co={panel.co} focal={focal} onClose={() => setPanel(null)} onRecenter={(t) => router.push(`/map/${t}`)} />}
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

function Badge({ rel }: { rel: Rel }) { const b = badgeOf(rel); return <span className={`badge ${b.cls}`}>{b.label}</span>; }

function LinkPanel({ rel, onClose }: { rel: Rel; onClose: () => void }) {
  return (
    <div className="panel">
      <button className="x" onClick={onClose} aria-label="Close">×</button>
      <h3>{rel.source.name} {TYPE_LABEL[rel.relationship_type]} {rel.target.name}</h3>
      <p><Badge rel={rel} /></p>
      <dl>
        <dt>Size of the link</dt><dd>{exposureText(rel)}</dd>
        <dt>Confidence</dt><dd>{rel.confidence == null ? "Not scored yet" : rel.confidence.toFixed(2)}</dd>
        <dt>As of</dt><dd>{rel.as_of_date ?? "Date not given"}</dd>
        <dt>Kind of source</dt><dd>{rel.source_type === "sec_filing" ? "SEC filing (10-K)" : rel.source_type ?? "Not given"}</dd>
      </dl>
      <h4>Evidence</h4>
      {rel.evidence.length === 0 ? <p className="muted">No source quote saved for this link.</p> : rel.evidence.map((e, i) => (
        <blockquote key={i}>
          “{e.quote}”
          <footer>{e.section ? `${e.section.replace("_", " ")} · ` : ""}{e.published_at ? `filed ${e.published_at} · ` : ""}{e.quote_found ? "quote found word for word · " : ""}
            {e.document_url && <a href={e.document_url} target="_blank" rel="noreferrer">original document</a>}</footer>
        </blockquote>
      ))}
      <p className="muted small">The panel shows what the sources say. It does not say a news item or price move caused a link.</p>
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
      <h3>{co.name} {co.ticker && <span className="muted">({co.ticker})</span>}</h3>
      {!mapped ? (
        <>
          <p className="muted">{co.entity_type === "group" ? "A group with no stock ticker." : "This company is not yet mapped."} The map shows only what {focal.name}'s filings say about it.</p>
        </>
      ) : err ? (
        <p>Could not load this company. <button className="chip" onClick={() => setN(n + 1)}>Retry</button></p>
      ) : !data ? <p className="muted">Loading…</p> : (
        <>
          {q ? (
            <p className="price sm">${q.price.toFixed(2)} <span className={q.change >= 0 ? "up" : "down"}>{q.change >= 0 ? "+" : ""}{q.change.toFixed(2)} ({q.changePct.toFixed(2)}%)</span></p>
          ) : <p className="muted">Data unavailable: {data.quoteError}</p>}
          {q && <p className="muted small">Prev close {q.prevClose.toFixed(2)} · Day range {q.low.toFixed(2)} to {q.high.toFixed(2)}</p>}
          <p className="muted small">{data.company.segment} · {data.company.size_tier} cap</p>
          <p className="small">Mapped links: {data.counts.suppliers} suppliers, {data.counts.customers} customers, {data.counts.partners} partners, {data.counts.rivals} rivals.</p>
          <p className="muted small">About: not available yet. Latest news: not available right now.</p>
          <div className="actions">
            <Link className="chip" href={`/company/${co.ticker}`}>Open full page</Link>
            {co.id !== focal.id && <button className="chip" onClick={() => onRecenter(co.ticker!)}>Recenter map here</button>}
          </div>
        </>
      )}
    </div>
  );
}
