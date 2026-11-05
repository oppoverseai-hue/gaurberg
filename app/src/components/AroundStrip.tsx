// Linked companies around the one on screen (GRF-18, GRF-20, UX-4). Facts only; no cause is claimed.
// Overview: AroundMoves, the large moves at the last close, with one teaser line pointing to the Earnings tab.
// Earnings tab: ReportsSoon (next 14 days, at most MAX_REPORTS rows until "Show all") and ReportsRecent (last 7 days).
import Link from "next/link";
import SourceTip from "@/components/SourceTip";
import { isMapped } from "@/lib/graph";
import type { Move, Report } from "@/lib/around-core";
import { shortName } from "@/lib/about-core";

const day = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const timing = (detail: string | null) => (detail?.includes("before market open") ? "before open" : detail?.includes("after market close") ? "after close" : null);

export const MAX_REPORTS = 5;

function Name({ co }: { co: Report["co"] }) {
  return isMapped(co) ? <Link href={`/company/${co.ticker}`}>{co.name}</Link> : <span>{co.name}</span>;
}

const reportRow = (r: Report) => (
  <div key={`${r.co.id}${r.date}`} className="around-row">
    <span className={`mono ${r.when === "today" ? "around-today" : ""}`}>{r.when === "today" ? "Today" : day(r.date)}{timing(r.detail) ? ` · ${timing(r.detail)}` : ""}</span>
    <span><Name co={r.co} /> <span className="muted">{r.roles.join(", ")}</span></span>
  </div>
);

/** Overview card: linked companies that moved 4% or more at the last close, and a line to the Earnings tab. */
export default function AroundMoves({ name, ticker, moves, linked, withPrices, soon, nextReport }: { name: string; ticker: string; moves: Move[]; linked: number; withPrices: number; soon: number; nextReport: string | null }) {
  if (!linked) return null;
  return (
    <div className="card around" id="around">
      <div className="cardhead"><h3>Linked companies&apos; price moves</h3><SourceTip text={`The ${linked} companies linked to ${shortName(name)} in reviewed filings: their last closes, refreshed daily. A listed move is a fact about that company, not a claim that it affects ${shortName(name)}.`} /></div>
      {moves.length ? (
        <>
          <p className="label">Moved 4% or more at the last close</p>
          {moves.map((m) => (
            <div key={m.co.id} className="around-row">
              <span className={`mono ${m.pct >= 0 ? "up" : "down"}`}>{m.pct >= 0 ? "+" : ""}{m.pct.toFixed(1)}%</span>
              <span><Name co={m.co} /> <span className="muted">{m.roles.join(", ")}</span></span>
            </div>
          ))}
        </>
      ) : <p className="muted mono around-quiet">{withPrices ? `No moves of 4% or more at the last close among the ${withPrices} linked companies with stored prices.` : "No stored prices for the linked companies yet."}</p>}
      <p className="around-teaser mono">
        Next report {nextReport ? day(nextReport) : "not known"} · {soon} linked {soon === 1 ? "company reports" : "companies report"} in the next 14 days{" "}
        <Link href={`/company/${ticker}/earnings`}>→ Earnings</Link>
      </p>
    </div>
  );
}

/** Earnings tab: linked companies reporting in the next 14 days. */
export function ReportsSoon({ name, reports }: { name: string; reports: Report[] }) {
  const soon = reports.filter((r) => r.when !== "reported");
  return (
    <div className="card around" id="reporting-soon">
      <div className="cardhead"><h3>Linked companies reporting in the next 14 days</h3><SourceTip text={`Earnings dates of the companies linked to ${shortName(name)} in reviewed filings (Finnhub calendar and SEC filings, reviewed). A date is a fact about that company, not a claim that it affects ${shortName(name)}.`} /></div>
      {soon.length ? soon.slice(0, MAX_REPORTS).map(reportRow) : <p className="muted mono" style={{ fontSize: 12, margin: 0 }}>None of the linked companies has a known date in the next 14 days.</p>}
      {soon.length > MAX_REPORTS && (
        <details className="around-more">
          <summary><span className="more">Show all {soon.length}</span><span className="less">Show first {MAX_REPORTS}</span></summary>
          {soon.slice(MAX_REPORTS).map(reportRow)}
        </details>
      )}
    </div>
  );
}

/** Earnings tab: linked companies that reported in the last 7 days. */
export function ReportsRecent({ reports }: { reports: Report[] }) {
  const done = reports.filter((r) => r.when === "reported");
  return (
    <div className="card around" id="reported-recently">
      <div className="cardhead"><h3>Linked companies reported in the last 7 days</h3></div>
      {done.length ? done.map(reportRow) : <p className="muted mono" style={{ fontSize: 12, margin: 0 }}>None of the linked companies reported in the last 7 days.</p>}
    </div>
  );
}
