import { notFound, redirect } from "next/navigation";
import Breadcrumbs from "@/components/Breadcrumbs";
import CompanyTabs from "@/components/CompanyTabs";
import SourceTip from "@/components/SourceTip";
import MoveCell from "@/components/MoveCell";
import ReactionCard from "@/components/ReactionCard";
import { ReportsRecent, ReportsSoon } from "@/components/AroundStrip";
import { getAccess } from "@/lib/supabase/server";
import { getCompany, getRels } from "@/lib/data";
import { getAround } from "@/lib/around";
import { getReaction } from "@/lib/reaction";
import { getUpcomingEvents } from "@/lib/marketdb";
import { ownReports, TIMING_WORDS } from "@/lib/reaction-core";
import { possessive } from "@/lib/about-core";

export const dynamic = "force-dynamic";

// Earnings tab (GRF-20, UX-4): the company's own reports, then linked companies reporting soon and recently, then how linked
// companies moved on the company's report days. Same reads as the overview's cards (promoted rows only); nothing estimated.
const day = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const short = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const timingOfDetail = (detail: string | null) => (detail?.includes("before market open") ? "before the open" : detail?.includes("after market close") ? "after the close" : null);

export default async function Earnings({ params }: { params: Promise<{ ticker: string }> }) {
  const access = await getAccess();
  if (access.state !== "ok") redirect("/");
  const ticker = (await params).ticker.toUpperCase();
  const company = await getCompany(ticker);
  if (!company) notFound();
  const [{ rels }, events] = await Promise.all([getRels(company.id), getUpcomingEvents(company.id)]);
  const [around, reaction] = await Promise.all([getAround(rels, company.id), getReaction(company, rels)]);
  const next = events.find((e) => e.event_type === "earnings" && e.status === "promoted");
  const own = reaction.table ? ownReports(reaction.table) : [];
  return (
    <main className="earnings">
      <Breadcrumbs items={[{ label: company.name, href: `/company/${company.ticker ?? ticker}` }, { label: "Earnings" }]} />
      <div className="head"><div className="row1"><h1>{company.name}</h1><span className="tag">{company.ticker}</span></div></div>
      <CompanyTabs ticker={company.ticker ?? ticker} active="earnings" />

      <div className="card" id="own-earnings" style={{ marginTop: 0 }}>
        <div className="cardhead"><h3>{possessive(company.name)} own earnings</h3><SourceTip text="Next date: the earnings calendar, reviewed. Past reports: SEC 8-K item 2.02 filings, reviewed by the admin, with the acceptance time. The move is the company's own 1-day close-to-close move, by the same rule as the table below." /></div>
        <p className="mono" style={{ fontSize: 12, margin: "0 0 10px" }}>
          <span className="muted">Next report: </span>{next ? <>{day(next.event_date)}{timingOfDetail(next.detail) ? `, ${timingOfDetail(next.detail)}` : ""}</> : "not known"}
        </p>
        {own.length ? (
          <div className="rx-scroll">
            <table className="rx">
              <thead><tr><th>Quarter</th><th>Reported</th><th>Timing</th><th>1-day move</th></tr></thead>
              <tbody>
                {own.map((o) => (
                  <tr key={o.date}>
                    <td><a href={o.url} target="_blank" rel="noopener noreferrer" title="The 8-K filing">{o.quarter} ↗</a></td>
                    <td className="mono">{day(o.date)}</td>
                    <td>{TIMING_WORDS[o.timing]}</td>
                    <td className="mono">{"pct" in o.move
                      ? <MoveCell text={`${o.move.pct >= 0 ? "+" : ""}${o.move.pct.toFixed(1)}%`} cls={o.move.pct >= 0 ? "up" : "down"} note={o.compared ? o.compared.replace(/(\d{4}-\d{2}-\d{2})/g, (d) => short(d)) : ""} />
                      : <MoveCell text="n/a" cls="muted" note={o.move.missing} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="muted mono" style={{ fontSize: 12, margin: 0 }}>{reaction.why}</p>}
      </div>

      <ReportsSoon name={company.name} reports={around.reports} />
      <ReportsRecent reports={around.reports} />
      <ReactionCard name={company.name} data={reaction} />
    </main>
  );
}
