import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAccess } from "@/lib/supabase/server";
import { getCompany } from "@/lib/data";
import { promotedRelsFor } from "@/lib/connect";
import { sourceLabel } from "@/lib/connect-core";
import { getPromotedEarnings } from "@/lib/marketdb";
import { buildExposure, figureInQuote, KINDS, KIND_LABEL, EMPTY, NOT_DISCLOSED, NO_SIZE, type ExpRow } from "@/lib/exposure-core";
import { monthYear, relationText, summaryLine } from "@/lib/exposure-text";
import SourceTip from "@/components/SourceTip";
import { badgeOf, isMapped, type Evidence } from "@/lib/graph";

export const dynamic = "force-dynamic";

// "Who is exposed to [company]" (GRF-17): companies one link away, from promoted links only, for every viewer.
// Weights follow GRF-11 and are ranked only within one kind of share. A default is stated once on the group; rows tag only the exceptions.

// Hover text for the labels on this page. Badge wording follows the Sources page.
const BADGE_TIP: Record<string, string> = {
  "Verified": "Found by an agent, the quote matches the filing word for word, it passed the checks, and the admin reviewed it.",
  "Curated": "Entered by hand with a source note.",
  "Live-generated, not reviewed": "Created on request. Nobody has reviewed it.",
  "Sample data": "Placeholder data.",
  "Staged, not reviewed": "Loaded by an agent but not yet reviewed by the admin.",
};
const KIND_TIP: Record<string, string> = {
  "Seller's revenue": "The percentage is a share of the seller's revenue.",
  "Buyer's costs": "The percentage is a share of the buyer's costs.",
  "Ownership": "The percentage is an ownership stake.",
};
const GROUP_TIP = {
  ranked: "Ranked by the percentage the source states, highest first. Only compared within this kind of share: shares of different kinds are never converted or compared.",
  unweighted: "Real links from the source that give no usable percentage: the source states no figure, the figure is not in a saved quote, or it is the other company's share. Nothing is estimated or filled in.",
  partners: "A partnership the source names but gives no strength for, so there is nothing to rank.",
  competitors: "Rivals named in the filings. A hit to this company can help or hurt them, so they are never counted as exposure.",
};

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

function Row({ x, earnings, focal }: { x: ExpRow; earnings?: string; focal: { id: number; name: string } }) {
  const r = x.rel, b = badgeOf(r), asOf = monthYear(r.as_of_date);
  // For a ranked row, show the saved quote that states the figure.
  const proof = x.weight != null ? r.evidence.find((e) => figureInQuote(x.weight!, [e.quote])) : undefined;
  return (
    <div className="xrow">
      <div className="xline">
        {isMapped(x.co) ? <Link href={`/company/${x.co.ticker}`}><strong>{x.co.name}</strong></Link> : <strong>{x.co.name}</strong>}
        {x.co.ticker && <span className="xtk">{x.co.ticker}</span>}
        {x.kind && <span className="tag" title={KIND_TIP[x.kindLabel]}>{x.kindLabel}</span>}
        <span className={`badge ${b.cls}`} title={BADGE_TIP[b.label]}>{b.label}</span>
        {x.weight != null && <span className="xw">{x.weight}%</span>}
      </div>
      {x.text !== NOT_DISCLOSED && x.text !== NO_SIZE && <p className="xtext">{x.text}</p>}
      {x.flag && <p className="xflag">⚠ {x.flag}</p>}
      <p className="xmeta">
        {relationText(r, focal.id, focal.name)} · {sourceLabel(r)}{asOf ? `, ${asOf}` : ""}
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

function Group({ title, rows, earnings, focal, note, info }: { title: string; rows: ExpRow[]; earnings: Map<number, string>; focal: { id: number; name: string }; note?: string; info: string }) {
  if (rows.length === 0) return null;
  return (
    <section className="card">
      <div className="cardhead">
        <div>
          <h3>{title} · {rows.length} <SourceTip text={info} label="About this group" /></h3>
          {note && <p className="xnote">{note}</p>}
        </div>
      </div>
      {rows.map((x) => <Row key={x.rel.id} x={x} earnings={earnings.get(x.co.id)} focal={focal} />)}
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
  const summary = summaryLine(e);
  const focal = { id: co.id, name: co.name };
  return (
    <main className="narrow exposure">
      <div className="crumb mono" style={{ fontSize: 12 }}>
        <Link href={`/map/${ticker}`}>← Ecosystem map</Link><span className="muted">|</span><Link href={`/company/${ticker}`}>Company page</Link>
      </div>
      <h1 style={{ marginTop: 12 }}>Who is exposed to {co.name} <span className="tag">{ticker}</span></h1>
      {!error && summary && <p className="xsum">{summary}</p>}
      <p className="muted">
        Companies linked to {co.name} in its filings, from reviewed links only. A percentage is shown only when the source states it.
        {earnings.get(co.id) ? ` ${co.name} next reports earnings on ${earnings.get(co.id)}.` : ""}
      </p>
      {error ? (
        <div className="card"><p>Could not load links. <Link href={`/company/${ticker}/exposure`}>Retry</Link></p></div>
      ) : (
        <>
          {e.empty && <div className="card"><p style={{ margin: 0 }}>{EMPTY}</p></div>}
          {KINDS.map((k) => <Group key={k} title={`${KIND_LABEL[k]} · ranked by stated share`} rows={e.ranked[k]} earnings={earnings} focal={focal} info={GROUP_TIP.ranked} />)}
          <Group title="Linked, size not given" rows={e.unweighted} earnings={earnings} focal={focal} info={GROUP_TIP.unweighted} note="The filings confirm these links but don't say how big they are." />
          <Group title="Partners" rows={e.partners} earnings={earnings} focal={focal} info={GROUP_TIP.partners} note="Named in the filings; no strength given." />
          <Group title="Competitors" rows={e.competitors} earnings={earnings} focal={focal} info={GROUP_TIP.competitors} note={`Not counted as exposure. ${co.name}'s trouble could help or hurt them.`} />
          <p className="muted mono" style={{ fontSize: 10, margin: "12px 0 0" }}>
            One hop only. Shows what our sources disclose about each link, not a prediction of how a company would be affected. No figure is estimated,
            averaged or filled in. This describes sources and is not a recommendation.
          </p>
        </>
      )}
    </main>
  );
}
