import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";
import CompanyTabs from "@/components/CompanyTabs";
import ExposureMatrix, { type MatrixCo } from "@/components/ExposureMatrix";
import { notFound, redirect } from "next/navigation";
import { getAccess } from "@/lib/supabase/server";
import { getCompany, getRels } from "@/lib/data";
import { promotedRelsFor } from "@/lib/connect";
import { sourceLabel } from "@/lib/connect-core";
import { getPromotedEarnings } from "@/lib/marketdb";
import { buildExposure, buildMatrix, KINDS, EMPTY, NOT_DISCLOSED, NO_SIZE, type ExpLink, type ExpRow } from "@/lib/exposure-core";
import { monthYear, relationText, summaryLine } from "@/lib/exposure-text";
import { getComove } from "@/lib/comove";
import { MIN_DAYS, WINDOW } from "@/lib/comove-core";
import { getReaction } from "@/lib/reaction";
import { badgeOf, isGroup, isMapped, SIDES, SIDE_LABEL } from "@/lib/graph";
import { possessive } from "@/lib/about-core";

export const dynamic = "force-dynamic";

// "Who is exposed to [company]" (GRF-17, GRF-19): every company one link away, from promoted links only, as a matrix of measured
// price pattern (correlation and beta of daily returns, from comove-core) and as a table. Links, quotes and shares are stored rows;
// nothing is estimated, sized or predicted.

// Reviewed links carry no badge (the page says once that its links are reviewed); a badge marks only a link that is not reviewed,
// such as live-generated or sample data (UX-4).
const REVIEWED = new Set(["b-verified", "b-curated"]);
const unreviewed = (r: ExpLink["rel"]) => !REVIEWED.has(badgeOf(r).cls);
// "SEC filing, Dec 2025" for a link, and its document when one is saved.
const sourceOf = (r: ExpLink["rel"]) => { const asOf = monthYear(r.as_of_date); return `${sourceLabel(r)}${asOf ? `, ${asOf}` : ""}`; };
const short = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

// The sources of a company's links, once each ("SEC filing, Dec 2025"), each linked to its first saved document.
function sources(x: ExpRow): { label: string; url: string | null }[] {
  const by = new Map<string, string | null>();
  for (const l of x.links) {
    const label = sourceOf(l.rel), url = l.rel.evidence.find((e) => e.document_url)?.document_url ?? null;
    if (!by.has(label) || (!by.get(label) && url)) by.set(label, url);
  }
  return [...by].map(([label, url]) => ({ label, url }));
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
  const [earnings, cm, reaction] = await Promise.all([
    getPromotedEarnings([...new Set([co.id, ...rels.flatMap((r) => [r.source.id, r.target.id])])]),
    error ? Promise.resolve({}) : getComove(co.id, rels),
    getReaction(co, rels),
  ]);
  const summary = summaryLine(e);
  const all = [...KINDS.flatMap((k) => e.ranked[k]), ...e.unweighted, ...e.partners, ...e.competitors];
  const matrix = buildMatrix(all, cm);
  const mapLine = SIDES.map((s) => [SIDE_LABEL[s], matrix.counts[s]] as const).filter(([, n]) => n > 0).map(([l, n]) => `${l} ${n}`).join(" · ");
  const marked = all.reduce((a, x) => a + x.links.filter((l) => unreviewed(l.rel)).length, 0);
  const point = new Map(matrix.points.map((p) => [p.id, p]));
  const why = new Map(matrix.excluded.map((x) => [x.id, x.reason]));
  const moveRow = new Map((reaction.table?.rows ?? []).map((r) => [r.co.id, r]));
  const cos: MatrixCo[] = all.map((x) => ({
    id: x.co.id, name: x.co.name, ticker: x.co.ticker, href: isMapped(x.co) ? `/company/${x.co.ticker}` : null, group: isGroup(x.co), place: x.place,
    point: point.get(x.co.id) ?? null, reason: why.get(x.co.id) ?? null, next: earnings.get(x.co.id) ?? null, sources: sources(x),
    links: x.links.map((l) => ({
      text: relationText(l.rel, co.id, co.name),
      share: l.text !== NOT_DISCLOSED && l.text !== NO_SIZE ? l.text : null,
      badge: unreviewed(l.rel) ? badgeOf(l.rel).label : null,
      quotes: l.rel.evidence.filter((v) => v.quote).map((v) => ({ quote: v.quote!, url: v.document_url, section: v.section, filed: v.published_at })),
      url: l.rel.evidence.find((v) => v.document_url)?.document_url ?? null,
    })),
    moves: reaction.table ? reaction.table.cols.map((c, i) => {
      const m = moveRow.get(x.co.id)?.moves[i];
      return { quarter: c.quarter, date: c.date, pct: m && "pct" in m ? m.pct : null,
        note: !m ? "No stored prices" : "pct" in m ? (c.reaction.kind === "day" ? `${short(c.reaction.day)} close vs ${short(c.reaction.prev)} close` : "") : m.missing };
    }) : [],
  }));
  return (
    <main className="exposure xm-page">
      <Breadcrumbs items={[{ label: co.name, href: `/company/${ticker}` }, { label: "Who is exposed" }]} />
      <CompanyTabs ticker={ticker} active="exposure" />
      <h1 style={{ marginTop: 12 }}>Who is exposed to {co.name} <span className="tag">{ticker}</span></h1>
      {!error && summary && <p className="xsum">{summary}</p>}
      {!error && mapLine && <p className="muted mono" style={{ fontSize: 11, margin: "0 0 8px" }} title="Each company sits in one group, by the same rule as the ecosystem map">Map groups: {mapLine}</p>}
      {!error && <p className="muted mono" style={{ fontSize: 11, margin: "0 0 8px" }}>{marked === 0 ? "All links shown are reviewed." : `All links shown are reviewed except ${marked} marked ${marked === 1 ? "link" : "links"}.`}</p>}
      {!error && live > 0 && (
        <p className="xflag">Reviewed links only: {live} live-generated {live === 1 ? "link" : "links"} (not reviewed) {live === 1 ? "is" : "are"} on the map but not on this page, so some counts here are lower than the map&apos;s.</p>
      )}
      <p className="muted">
        Companies linked to {co.name} in its filings, from reviewed links only, placed by how their daily returns moved with {possessive(co.name)}.
        {earnings.get(co.id) ? ` ${co.name} next reports earnings on ${earnings.get(co.id)}.` : ""}
      </p>
      {error ? (
        <div className="card"><p>Could not load links. <Link href={`/company/${ticker}/exposure`}>Retry</Link></p></div>
      ) : e.empty && !all.length ? (
        <div className="card"><p style={{ margin: 0 }}>{EMPTY}</p></div>
      ) : (
        <>
          <ExposureMatrix focal={co.name} cos={cos} counts={matrix.counts} />
          <p className="muted mono" style={{ fontSize: 10, margin: "12px 0 0" }}>
            One hop only. Correlation and beta use daily closes over the last {WINDOW} shared trading days (at least {MIN_DAYS} needed): a measured
            price pattern, not a disclosed size and not a prediction. Links, shares and quotes are stored as the sources give them; nothing is
            estimated or filled in. This describes sources and is not a recommendation.
          </p>
        </>
      )}
    </main>
  );
}
