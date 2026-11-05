// "Earnings-day reaction" card (GRF-20): how the focal company and each linked company with stored prices closed on the trading day
// that reacted to each of the focal company's last 4 reports. Facts only: a move on that day is not claimed to be caused by the report.
import Link from "next/link";
import SourceTip from "@/components/SourceTip";
import { isMapped, type Co } from "@/lib/graph";
import type { ReactionData } from "@/lib/reaction";

const day = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const short = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export default function ReactionCard({ name, data }: { name: string; data: ReactionData }) {
  const t = data.table;
  return (
    <div className="card" id="reaction">
      <div className="cardhead">
        <h3>Earnings-day reaction</h3>
        <SourceTip text={`Report dates and times from ${name}'s SEC 8-K item 2.02 filings, reviewed by the admin. Before 9:30 ET: that day's close against the previous close. After 16:00 ET: the next trading day's close against that day's close. During market hours: not shown. Closes are stored daily; nothing is estimated.`} />
      </div>
      {!t ? <p className="muted mono" style={{ fontSize: 12, margin: 0 }}>{data.why}</p> : (
        <>
          <div className="rx-scroll">
            <table className="rx">
              <thead>
                <tr>
                  <th>Company</th>
                  {t.cols.map((c) => (
                    <th key={c.date}>
                      <a href={c.url} target="_blank" rel="noopener noreferrer" title="The 8-K filing">{c.quarter} ↗</a>
                      <small>Reported {day(c.date)}</small>
                      <small className={c.reaction.kind === "flag" ? "warn" : ""}>{c.reaction.kind === "day" ? `${short(c.reaction.day)} vs ${short(c.reaction.prev)}` : "Not shown"}</small>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.rows.map((r) => (
                  <tr key={r.co.id} className={r.focal ? "focal" : ""}>
                    <td>{!r.focal && isMapped(r.co as Co) ? <Link href={`/company/${r.co.ticker}`}>{r.co.name}</Link> : r.co.name}</td>
                    {r.moves.map((m, i) => (
                      <td key={t.cols[i].date} className="mono">
                        {"pct" in m ? <span className={m.pct >= 0 ? "up" : "down"}>{m.pct >= 0 ? "+" : ""}{m.pct.toFixed(1)}%</span> : <span className="muted" title={m.missing}>n/a</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {t.cols.some((c) => c.reaction.kind === "flag") && (
            <ul className="rx-notes">{t.cols.filter((c) => c.reaction.kind === "flag").map((c) => <li key={c.date}>{c.quarter}: {c.reaction.kind === "flag" ? c.reaction.reason : ""}.</li>)}</ul>
          )}
          <p className="muted mono" style={{ fontSize: 11, margin: "8px 0 0" }}>
            Close-to-close moves on the trading day after each report. Hover n/a for the missing close.
            {t.unpriced ? ` ${t.unpriced} linked ${t.unpriced === 1 ? "company has" : "companies have"} no stored prices (listed outside the US, or not loaded yet).` : ""}
            {" "}A move on that day is a fact about the price, not a claim that the report caused it.
          </p>
        </>
      )}
    </div>
  );
}
