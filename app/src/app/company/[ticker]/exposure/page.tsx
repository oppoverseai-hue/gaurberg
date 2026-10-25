import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAccess } from "@/lib/supabase/server";
import { getCompany } from "@/lib/data";
import { promotedRelsFor } from "@/lib/connect";
import { sourceLabel } from "@/lib/connect-core";
import { getPromotedEarnings } from "@/lib/marketdb";
import { buildExposure, figureInQuote, KINDS, KIND_LABEL, GROUP, EMPTY, type ExpRow } from "@/lib/exposure-core";
import { badgeOf, isMapped, TYPE_LABEL, type Evidence } from "@/lib/graph";

export const dynamic = "force-dynamic";

// "If [company] is hit" (GRF-17): companies one link away, from promoted links only, for every viewer.
// Weights follow GRF-11 and are ranked only within one kind of share.

function Quote({ e }: { e: Evidence }) {
  return (
    <blockquote>
      “{e.quote}”
      <footer>
        {e.section ? `${/^p\d+$/.test(e.section) ? `page ${e.section.slice(1)}` : e.section.replace(/_/g, " ")} · ` : ""}
        {e.published_at ? `filed ${e.published_at} · ` : ""}
        {e.document_url ? <a href={e.document_url} target="_blank" rel="noreferrer">View source ↗</a> : "no document link saved"}
      </footer>
    </blockquote>
  );
}

function Row({ x, earnings }: { x: ExpRow; earnings?: string }) {
  const r = x.rel, b = badgeOf(r);
  // For a ranked row, show the saved quote that states the figure.
  const proof = x.weight != null ? r.evidence.find((e) => figureInQuote(x.weight!, [e.quote])) : undefined;
  return (
    <div className="xrow">
      <div className="xline">
        {isMapped(x.co) ? <Link href={`/company/${x.co.ticker}`}><strong>{x.co.name}</strong></Link> : <strong>{x.co.name}</strong>}
        {x.co.ticker && <span className="tag">{x.co.ticker}</span>}
        <span className="tag">{x.kindLabel}</span>
        <span className={`badge ${b.cls}`}>{b.label}</span>
        {x.weight != null && <span className="xw">{x.weight}%</span>}
      </div>
      <p className="xtext">{x.text}</p>
      {x.flag && <p className="xflag">⚠ {x.flag}</p>}
      <p className="muted mono" style={{ fontSize: 11, margin: "4px 0 0" }}>
        {r.source.name} {TYPE_LABEL[r.relationship_type]} {r.target.name} · Source: {sourceLabel(r)}{r.as_of_date ? ` · as of ${r.as_of_date}` : ""}
        {earnings ? ` · next earnings ${earnings}` : ""}
      </p>
      {proof && <Quote e={proof} />}
      {x.context.map((c, i) => (
        <div key={i}>
          <p className="xctx">Context: {c.text}</p>
          {c.quote && <Quote e={c.quote} />}
        </div>
      ))}
    </div>
  );
}

function Group({ title, rows, earnings, note }: { title: string; rows: ExpRow[]; earnings: Map<number, string>; note?: string }) {
  if (rows.length === 0) return null;
  return (
    <section className="card">
      <div className="cardhead"><h3>{title} · {rows.length}</h3>{note && <span className="muted mono" style={{ fontSize: 11 }}>{note}</span>}</div>
      {rows.map((x) => <Row key={x.rel.id} x={x} earnings={earnings.get(x.co.id)} />)}
    </section>
  );
}

export default async function Exposure({ params }: { params: Promise<{ ticker: string }> }) {
  const access = await getAccess();
  if (access.state !== "ok") redirect("/");
  const ticker = (await params).ticker.toUpperCase();
  const co = await getCompany(ticker);
  if (!co) notFound();
  const { rels, error } = await promotedRelsFor([co.id]);
  const e = buildExposure(co.id, rels);
  const earnings = await getPromotedEarnings([...new Set([co.id, ...rels.flatMap((r) => [r.source.id, r.target.id])])]);
  return (
    <main className="narrow exposure">
      <div className="crumb mono" style={{ fontSize: 12 }}>
        <Link href={`/map/${ticker}`}>← Ecosystem map</Link><span className="muted">|</span><Link href={`/company/${ticker}`}>Company page</Link>
      </div>
      <h1 style={{ marginTop: 12 }}>If {co.name} is hit <span className="tag">{ticker}</span></h1>
      <p className="muted">
        Companies with one disclosed link to {co.name}, from reviewed (promoted) links only. A percentage counts as a weight only when it is the
        listed company&apos;s own share and the saved quote contains the figure. Weights are ranked only within one kind of share.
        {earnings.get(co.id) ? ` ${co.name} next reports earnings on ${earnings.get(co.id)}.` : ""}
      </p>
      {error ? (
        <div className="card"><p>Could not load links. <Link href={`/company/${ticker}/exposure`}>Retry</Link></p></div>
      ) : (
        <>
          {e.empty && <div className="card"><p style={{ margin: 0 }}>{EMPTY}</p></div>}
          {KINDS.map((k) => <Group key={k} title={`${KIND_LABEL[k]} · ranked by stated share`} rows={e.ranked[k]} earnings={earnings} />)}
          <Group title={GROUP.unweighted} rows={e.unweighted} earnings={earnings} />
          <Group title={GROUP.partners} rows={e.partners} earnings={earnings} />
          <Group title={GROUP.competitors} rows={e.competitors} earnings={earnings} note="Competitors are never counted as exposure." />
          <p className="muted mono" style={{ fontSize: 10, margin: "12px 0 0" }}>
            One hop only. Shows what our sources disclose about each link, not a prediction of how a company would be affected. No figure is estimated,
            averaged or filled in. This describes sources and is not a recommendation.
          </p>
        </>
      )}
    </main>
  );
}
