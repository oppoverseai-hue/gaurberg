import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";
import CompanyTabs from "@/components/CompanyTabs";
import { notFound, redirect } from "next/navigation";
import { getAccess } from "@/lib/supabase/server";
import { getCompany, getRels } from "@/lib/data";
import { promotedRelsFor } from "@/lib/connect";
import { sourceLabel } from "@/lib/connect-core";
import { getPromotedEarnings } from "@/lib/marketdb";
import { buildExposure, figureInQuote, KINDS, KIND_LABEL, EMPTY, NOT_DISCLOSED, NO_SIZE, type ExpLink, type ExpRow } from "@/lib/exposure-core";
import { monthYear, relationText, summaryLine } from "@/lib/exposure-text";
import SourceTip from "@/components/SourceTip";
import { getComove } from "@/lib/comove";
import { comoveText, COMOVE_NOTE, MIN_DAYS, WINDOW, type Comove } from "@/lib/comove-core";
import { badgeOf, BADGE_MEANING, isGroup, isMapped, SIDES, SIDE_LABEL, type Evidence } from "@/lib/graph";

export const dynamic = "force-dynamic";

// "Who is exposed to [company]" (GRF-17): companies one link away, from promoted links only, for every viewer.
// Weights follow GRF-11 and are ranked only within one kind of share. A default is stated once on the group; rows tag only the exceptions.

// Hover text for the labels on this page. Badge wording is BADGE_MEANING in graph.ts (as on the Sources page).
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

// One link on a company's row: what it says, its kind of share and trust badge, and its evidence.
// Reviewed links carry no badge (the page says once that its links are reviewed); a badge marks only a link that is not
// reviewed, such as live-generated or sample data (UX-4).
const REVIEWED = new Set(["b-verified", "b-curated"]);
const unreviewed = (r: ExpLink["rel"]) => !REVIEWED.has(badgeOf(r).cls);
// "SEC filing, Dec 2025" for a link, and its document when one is saved.
const sourceOf = (r: ExpLink["rel"]) => { const asOf = monthYear(r.as_of_date); return `${sourceLabel(r)}${asOf ? `, ${asOf}` : ""}`; };

function LinkLine({ l, focal }: { l: ExpLink; focal: { id: number; name: string } }) {
  const r = l.rel, b = badgeOf(r);
  // For a ranked link, show the saved quote that states the figure.
  const proof = l.weight != null ? r.evidence.find((e) => figureInQuote(l.weight!, [e.quote])) : undefined;
  return (
    <div className="xlink">
      <p className="xmeta">
        <strong className="xrel">{relationText(r, focal.id, focal.name)}</strong>
        {l.kind && <span className="tag" title={KIND_TIP[l.kindLabel]}>{l.kindLabel}</span>}
        {unreviewed(r) && <span className={`badge ${b.cls}`} title={BADGE_MEANING[b.label]}>{b.label}</span>}
      </p>
      {l.text !== NOT_DISCLOSED && l.text !== NO_SIZE && <p className="xtext">{l.text}</p>}
      {l.flag && <p className="xflag">⚠ {l.flag}</p>}
      {proof && <Quote e={proof} />}
      {l.context.map((c, i) => (
        <div key={i}>
          <p className="xctx">Context: {c.text}</p>
          {c.quote && <Quote e={c.quote} />}
        </div>
      ))}
    </div>
  );
}

// One row per company (GRF-17): every link it has with the focal company, lead link first.
// The sources of a company's links, once each ("SEC filing, Dec 2025"), each linked to its first saved document.
function sources(x: ExpRow): { label: string; url: string | null }[] {
  const by = new Map<string, string | null>();
  for (const l of x.links) {
    const label = sourceOf(l.rel), url = l.rel.evidence.find((e) => e.document_url)?.document_url ?? null;
    if (!by.has(label) || (!by.get(label) && url)) by.set(label, url);
  }
  return [...by].map(([label, url]) => ({ label, url }));
}

function Row({ x, earnings, focal, cm }: { x: ExpRow; earnings?: string; focal: { id: number; name: string }; cm?: Comove }) {
  return (
    <div className="xrow">
      <div className="xline">
        {isMapped(x.co) ? <Link href={`/company/${x.co.ticker}`}><strong>{x.co.name}</strong></Link> : <strong>{x.co.name}</strong>}
        {x.co.ticker && <span className="xtk">{x.co.ticker}</span>}
        {isGroup(x.co) && <span className="tag" title="A group named in the filings (for example drivers or riders), not a company">Group</span>}
        {x.place === "both" && <span className="tag" title={`Links both into and out of ${focal.name}, as on the map`}>Both ways</span>}
        {x.links.length > 1 && <span className="muted mono" style={{ fontSize: 11 }}>{x.links.length} links</span>}
        {x.weight != null && <span className="xw">{x.weight}%</span>}
      </div>
      <p className="xmeta xsrc">{sources(x).map((s, i) => <span key={s.label}>{i ? " · " : ""}{s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.label} ↗</a> : s.label}</span>)}</p>
      {x.links.map((l) => <LinkLine key={l.rel.id} l={l} focal={focal} />)}
      {(earnings || cm) && (
        <p className="xmeta">
          {earnings ? `Next earnings ${earnings}` : ""}
          {cm && <span className="xcm" title={COMOVE_NOTE}>{earnings ? " · " : ""}Measured price pattern: {comoveText(cm, focal.name)}</span>}
        </p>
      )}
    </div>
  );
}

function Group({ title, rows, earnings, focal, note, info, cm }: { title: string; rows: ExpRow[]; earnings: Map<number, string>; focal: { id: number; name: string }; note?: string; info: string; cm: Record<number, Comove> }) {
  if (rows.length === 0) return null;
  return (
    <section className="card">
      <div className="cardhead">
        <div>
          <h3>{title} · {rows.length} <SourceTip text={info} label="About this group" /></h3>
          {note && <p className="xnote">{note}</p>}
        </div>
      </div>
      {rows.map((x) => <Row key={x.co.id} x={x} earnings={earnings.get(x.co.id)} focal={focal} cm={cm[x.co.id]} />)}
    </section>
  );
}

export default async function Exposure({ params }: { params: Promise<{ ticker: string }> }) {
  const access = await getAccess();
  if (access.state !== "ok") redirect("/");
  const ticker = (await params).ticker.toUpperCase();
  const co = await getCompany(ticker);
  if (!co) notFound();
  // Reviewed (promoted) links only. The map also shows live-generated links, so say how many are left out here.
  const [{ rels, error }, { rels: mapRels }] = await Promise.all([promotedRelsFor([co.id]), getRels(co.id)]);
  const live = mapRels.filter((r) => r.status === "live").length;
  const e = buildExposure(co.id, rels);
  const earnings = await getPromotedEarnings([...new Set([co.id, ...rels.flatMap((r) => [r.source.id, r.target.id])])]);
  const cm = error ? {} : await getComove(co.id, rels);
  const summary = summaryLine(e);
  // Same wording as the map's pagers: a company sits in one group, so a rival that also supplies is listed above with all its links.
  const also = (n: number, what: string) => (n ? ` ${n} more ${what} shown in other groups.` : "");
  const all = [...KINDS.flatMap((k) => e.ranked[k]), ...e.unweighted, ...e.partners, ...e.competitors];
  const mapLine = SIDES.map((s) => [SIDE_LABEL[s], all.filter((x) => x.place === s).length] as const).filter(([, n]) => n > 0).map(([l, n]) => `${l} ${n}`).join(" · ");
  const focal = { id: co.id, name: co.name };
  return (
    <main className="narrow exposure">
      <Breadcrumbs items={[{ label: co.name, href: `/company/${ticker}` }, { label: "Who is exposed" }]} />
      <CompanyTabs ticker={ticker} active="exposure" />
      <h1 style={{ marginTop: 12 }}>Who is exposed to {co.name} <span className="tag">{ticker}</span></h1>
      {!error && summary && <p className="xsum">{summary}</p>}
      {!error && mapLine && <p className="muted mono" style={{ fontSize: 11, margin: "0 0 8px" }} title="Each company sits in one group, by the same rule as the ecosystem map">Map groups: {mapLine}</p>}
      {!error && (() => {
        const n = all.reduce((a, x) => a + x.links.filter((l) => unreviewed(l.rel)).length, 0);
        return <p className="muted mono" style={{ fontSize: 11, margin: "0 0 8px" }}>{n === 0 ? "All links shown are reviewed." : `All links shown are reviewed except ${n} marked ${n === 1 ? "link" : "links"}.`}</p>;
      })()}
      {!error && live > 0 && (
        <p className="xflag">Reviewed links only: {live} live-generated {live === 1 ? "link" : "links"} (not reviewed) {live === 1 ? "is" : "are"} on the map but not on this page, so some counts here are lower than the map's.</p>
      )}
      <p className="muted">
        Companies linked to {co.name} in its filings, from reviewed links only. A percentage is shown only when the source states it.
        {earnings.get(co.id) ? ` ${co.name} next reports earnings on ${earnings.get(co.id)}.` : ""}
      </p>
      {error ? (
        <div className="card"><p>Could not load links. <Link href={`/company/${ticker}/exposure`}>Retry</Link></p></div>
      ) : (
        <>
          {e.empty && <div className="card"><p style={{ margin: 0 }}>{EMPTY}</p></div>}
          {KINDS.map((k) => <Group key={k} title={`${KIND_LABEL[k]} · ranked by stated share`} rows={e.ranked[k]} earnings={earnings} focal={focal} cm={cm} info={GROUP_TIP.ranked} />)}
          <Group title="Linked, size not given" rows={e.unweighted} earnings={earnings} focal={focal} cm={cm} info={GROUP_TIP.unweighted} note="The filings confirm these links but don't say how big they are." />
          <Group title="Partners" rows={e.partners} earnings={earnings} focal={focal} cm={cm} info={GROUP_TIP.partners} note={`Named in the filings; no strength given.${also(e.alsoPartner, "partners")}`} />
          <Group title="Competitors" rows={e.competitors} earnings={earnings} focal={focal} cm={cm} info={GROUP_TIP.competitors} note={`Not counted as exposure. ${co.name}'s trouble could help or hurt them.${also(e.alsoCompete, "competitors")}`} />
          <p className="muted mono" style={{ fontSize: 10, margin: "12px 0 0" }}>
            One hop only. Shows what our sources disclose about each link, not a prediction of how a company would be affected. No figure is estimated,
            averaged or filled in. This describes sources and is not a recommendation.
            {Object.keys(cm).length > 0 && ` "Measured price pattern" lines use daily closes over the last ${WINDOW} shared trading days (at least ${MIN_DAYS} needed). They are not a disclosed size and not a prediction.`}
          </p>
        </>
      )}
    </main>
  );
}
