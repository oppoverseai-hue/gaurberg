// "Around this company" card (GRF-18), under the price card on the company page (UX-4): linked companies that report soon or just
// reported, and linked companies with a large move at the last close. Facts only; no cause is claimed.
// With no large moves, the card says so in one line and the report list takes the full width. At most MAX_REPORTS rows show
// until "Show all" is opened.
import Link from "next/link";
import SourceTip from "@/components/SourceTip";
import { isMapped } from "@/lib/graph";
import type { Move, Report } from "@/lib/around-core";

const day = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const timing = (detail: string | null) => (detail?.includes("before market open") ? "before open" : detail?.includes("after market close") ? "after close" : null);

export const MAX_REPORTS = 5;

function Name({ co }: { co: Report["co"] }) {
  return isMapped(co) ? <Link href={`/company/${co.ticker}`}>{co.name}</Link> : <span>{co.name}</span>;
}

export default function AroundStrip({ name, reports, moves, linked, withPrices }: { name: string; reports: Report[]; moves: Move[]; linked: number; withPrices: number }) {
  if (!linked) return null;
  const soon = reports.filter((r) => r.when !== "reported"), done = reports.filter((r) => r.when === "reported");
  const row = (r: Report) => (
    <div key={`${r.co.id}${r.date}`} className="around-row">
      <span className={`mono ${r.when === "today" ? "around-today" : ""}`}>{r.when === "today" ? "Today" : day(r.date)}{timing(r.detail) ? ` · ${timing(r.detail)}` : ""}</span>
      <span><Name co={r.co} /> <span className="muted">{r.roles.join(", ")}</span></span>
    </div>
  );
  const reportList = (
    <div>
      <p className="label">Reporting in the next 14 days</p>
      {soon.length ? soon.slice(0, MAX_REPORTS).map(row) : <p className="muted mono" style={{ fontSize: 12, margin: 0 }}>None of the linked companies with a known date.</p>}
      {soon.length > MAX_REPORTS && (
        <details className="around-more">
          <summary><span className="more">Show all {soon.length}</span><span className="less">Show first {MAX_REPORTS}</span></summary>
          {soon.slice(MAX_REPORTS).map(row)}
        </details>
      )}
      {done.length > 0 && <p className="muted mono" style={{ fontSize: 11, margin: "8px 0 0" }}>Reported in the last 7 days: {done.map((r) => `${r.co.name} (${day(r.date)})`).join(" · ")}</p>}
    </div>
  );
  return (
    <div className="card around" id="around">
      <div className="cardhead"><h3>Around {name}</h3><SourceTip text={`The ${linked} companies linked to ${name} in reviewed filings: their earnings dates (Finnhub calendar) and last closes, refreshed daily. A listed date or move is a fact about that company, not a claim that it affects ${name}.`} /></div>
      {moves.length ? (
        <div className="around-grid">
          {reportList}
          <div>
            <p className="label">Moved 4% or more at the last close</p>
            {moves.map((m) => (
              <div key={m.co.id} className="around-row">
                <span className={`mono ${m.pct >= 0 ? "up" : "down"}`}>{m.pct >= 0 ? "+" : ""}{m.pct.toFixed(1)}%</span>
                <span><Name co={m.co} /> <span className="muted">{m.roles.join(", ")}</span></span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <p className="muted mono around-quiet">{withPrices ? `No moves of 4% or more at the last close among the ${withPrices} linked companies with stored prices.` : "No stored prices for the linked companies yet."}</p>
          {reportList}
        </>
      )}
    </div>
  );
}
