// "Linked companies' moves on <Company>'s earnings days" card (GRF-20, UX-4): how the focal company and each linked company with stored prices closed on the trading day
// that reacted to each of the focal company's last 4 reports. Facts only: a move on that day is not claimed to be caused by the report.
import Link from "next/link";
import SourceTip from "@/components/SourceTip";
import { isMapped, type Co } from "@/lib/graph";
import type { ReactionData } from "@/lib/reaction";
import type { ReportCol } from "@/lib/reaction-core";
import { possessive } from "@/lib/about-core";

const day = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const short = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

// The dates a column compares, in words: "5 Aug close vs 4 Aug close". Null for a column that is not shown.
const compared = (c: ReportCol) => (c.reaction.kind === "day" ? `${short(c.reaction.day)} close vs ${short(c.reaction.prev)} close` : null);

export default function ReactionCard({ name, data }: { name: string; data: ReactionData }) {
  const t = data.table;
  const perColumn = t ? t.cols.map((c) => `${c.quarter}: ${compared(c) ?? "not shown"}`).join("; ") : "";
  return (
    <div className="card" id="reaction">
      <div className="cardhead">
        <h3>Linked companies&apos; moves on {possessive(name)} earnings days</h3>
        <SourceTip text={`Report dates and times from ${possessive(name)} SEC 8-K item 2.02 filings, reviewed by the admin. Before 9:30 ET: that day's close against the previous close. After 16:00 ET: the next trading day's close against that day's close. During market hours: not shown. Closes are stored daily; nothing is estimated.${perColumn ? ` Dates compared: ${perColumn}.` : ""}`} />
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
                        {"pct" in m ? <span className={m.pct >= 0 ? "up" : "down"} title={compared(t.cols[i]) ?? undefined}>{m.pct >= 0 ? "+" : ""}{m.pct.toFixed(1)}%</span> : <span className="muted" title={m.missing}>n/a</span>}
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
            1-day close-to-close move. Reports before the open use that day against the previous close; reports after the close use the next trading day against that day&apos;s close. Hover a move for the dates compared, or n/a for the missing close.
            {t.unpriced ? ` ${t.unpriced} linked ${t.unpriced === 1 ? "company has" : "companies have"} no stored prices (listed outside the US, or not loaded yet).` : ""}
            {" "}A move on that day is a fact about the price, not a claim that the report caused it.
          </p>
        </>
      )}
    </div>
  );
}
