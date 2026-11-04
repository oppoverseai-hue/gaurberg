// "Around this company" strip (GRF-18), above the fold on the company page: linked companies that report soon or just
// reported, and linked companies with a large move at the last close. Facts only; no cause is claimed.
import Link from "next/link";
import SourceTip from "@/components/SourceTip";
import { isMapped } from "@/lib/graph";
import type { Move, Report } from "@/lib/around-core";

const day = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const timing = (detail: string | null) => (detail?.includes("before market open") ? "before open" : detail?.includes("after market close") ? "after close" : null);

function Name({ co }: { co: Report["co"] }) {
  return isMapped(co) ? <Link href={`/company/${co.ticker}`}>{co.name}</Link> : <span>{co.name}</span>;
}

export default function AroundStrip({ name, reports, moves, linked, withPrices }: { name: string; reports: Report[]; moves: Move[]; linked: number; withPrices: number }) {
  if (!linked) return null;
  const soon = reports.filter((r) => r.when !== "reported"), done = reports.filter((r) => r.when === "reported");
  return (
    <div className="card around" id="around">
      <div className="cardhead"><h3>Around {name}</h3><SourceTip text={`The ${linked} companies linked to ${name} in reviewed filings: their earnings dates (Finnhub calendar) and last closes, refreshed daily. A listed date or move is a fact about that company, not a claim that it affects ${name}.`} /></div>
      <div className="around-grid">
        <div>
          <p className="label">Reporting in the next 14 days</p>
          {soon.length ? soon.map((r) => (
            <div key={`${r.co.id}${r.date}`} className="around-row">
              <span className={`mono ${r.when === "today" ? "around-today" : ""}`}>{r.when === "today" ? "Today" : day(r.date)}{timing(r.detail) ? ` · ${timing(r.detail)}` : ""}</span>
              <span><Name co={r.co} /> <span className="muted">{r.roles.join(", ")}</span></span>
            </div>
          )) : <p className="muted mono" style={{ fontSize: 12, margin: 0 }}>None of the linked companies with a known date.</p>}
          {done.length > 0 && <p className="muted mono" style={{ fontSize: 11, margin: "8px 0 0" }}>Reported in the last 7 days: {done.map((r) => `${r.co.name} (${day(r.date)})`).join(" · ")}</p>}
        </div>
        <div>
          <p className="label">Moved 4% or more at the last close</p>
          {moves.length ? moves.map((m) => (
            <div key={m.co.id} className="around-row">
              <span className={`mono ${m.pct >= 0 ? "up" : "down"}`}>{m.pct >= 0 ? "+" : ""}{m.pct.toFixed(1)}%</span>
              <span><Name co={m.co} /> <span className="muted">{m.roles.join(", ")}</span></span>
            </div>
          )) : <p className="muted mono" style={{ fontSize: 12, margin: 0 }}>{withPrices ? `No large moves among the ${withPrices} linked companies with stored prices.` : "No stored prices for the linked companies yet."}</p>}
        </div>
      </div>
    </div>
  );
}
