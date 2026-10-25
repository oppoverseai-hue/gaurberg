import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccess } from "@/lib/supabase/server";
import { isUSListed } from "@/lib/marketdb";
import { dayLabel } from "@/lib/metrics-core";
import { buildCalendar, HORIZON, WINDOWS, type CalCo } from "@/lib/calendar-core";
import { loadCalendar } from "@/lib/calendar";

export const dynamic = "force-dynamic";

// Events calendar (TRM-13): upcoming earnings for every mapped company from stored Finnhub dates, grouped by week.
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const weekday = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

function CoList({ title, cos, note }: { title: string; cos: CalCo[]; note: string }) {
  if (!cos.length) return null;
  return (
    <details className="card cal-none">
      <summary><strong>{title}</strong> <span className="muted">({cos.length})</span></summary>
      <p className="muted mono" style={{ fontSize: 11, margin: "6px 0 8px" }}>{note}</p>
      <p style={{ margin: 0, fontSize: 13 }}>{cos.map((c, i) => <span key={c.id}>{i > 0 && " · "}<Link href={`/company/${c.ticker}`}>{c.name}</Link></span>)}</p>
    </details>
  );
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const access = await getAccess();
  if (access.state !== "ok") redirect("/");
  const sp = await searchParams;
  const w = (WINDOWS as readonly number[]).includes(Number(sp.w)) ? Number(sp.w) : 30;
  const today = new Date().toISOString().slice(0, 10);
  const data = await loadCalendar(today, addDays(today, HORIZON));
  const cal = buildCalendar(data.cos, data.events, data.loadedIds, (c) => isUSListed(c.markets), today, w);
  const shown = cal.weeks.reduce((n, x) => n + x.rows.length, 0);
  const fetched = [...new Set(data.events.map((e) => e.fetched_at.slice(0, 10)))].sort();
  return (
    <main className="narrow cal">
      <Link href="/" className="mono" style={{ fontSize: 12 }}>← Home</Link>
      <h1 style={{ marginTop: 12 }}>Earnings calendar</h1>
      <p className="muted">Upcoming earnings for the mapped companies, next {w} days, by week (weeks start on Monday).</p>
      <div className="scr-scope" role="tablist" aria-label="Window">
        {WINDOWS.map((n) => <Link key={n} href={`/calendar?w=${n}`} className={n === w ? "on" : ""}>{n} days</Link>)}
      </div>
      {(data.offline || data.error || (data.loadedIds.size === 0)) && (
        <p className="savedbar" style={{ marginTop: 16 }}>{data.offline ? "Offline: earnings dates are not saved for the offline demo." : data.error ? "Could not load earnings dates. Try again." : "Earnings dates are not loaded yet: nothing has been reviewed and published."}</p>
      )}
      {cal.weeks.length === 0 ? (
        !(data.offline || data.error || data.loadedIds.size === 0) && <div className="card" style={{ marginTop: 16 }}><p className="muted" style={{ margin: 0 }}>No earnings dates in the next {w} days.</p></div>
      ) : cal.weeks.map((wk) => (
        <section key={wk.start} className="card cal-week">
          <div className="cardhead"><h3>Week of {dayLabel(wk.start)}</h3><span className="label">{wk.rows.length} report{wk.rows.length === 1 ? "" : "s"}</span></div>
          <table className="scr-table">
            <tbody>
              {wk.rows.map((r) => (
                <tr key={`${r.c.id}-${r.date}`}>
                  <td className="mono" style={{ width: 110 }}>{weekday(r.date)}</td>
                  <td><Link href={`/company/${r.c.ticker}`} className="scr-name"><strong>{r.c.name}</strong></Link><span className="muted mono scr-sub">{r.c.ticker}{r.quarter ? ` · ${r.quarter}` : ""}</span></td>
                  <td className={`mono ${r.time ? "" : "muted"}`}>{r.time ?? "Time not given"}</td>
                  <td className="mono" title={`Finnhub, fetched ${dayLabel(r.fetched_at)}${r.status === "staged" ? " · staged, not reviewed" : ""}`}>
                    {r.conflict && <span className="cal-warn">dates conflict, unverified</span>}
                    {r.status === "staged" && <span className="muted scr-sub">staged</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      {cal.later.length > 0 && (
        <p className="mono" style={{ fontSize: 12, marginTop: 16 }}>
          <span className="muted">Later in the next {HORIZON} days: </span>
          {cal.later.map((l, i) => <span key={l.c.id}>{i > 0 && " · "}<Link href={`/company/${l.c.ticker}`}>{l.c.name}</Link> {dayLabel(l.date)}</span>)}
        </p>
      )}
      <CoList title={`No date in the next ${HORIZON} days`} cos={cal.noDate} note="Finnhub's calendar was checked and lists no earnings date for these companies in the next 90 days." />
      <CoList title="Not loaded yet" cos={cal.notLoaded} note={data.offline ? "Offline: no stored dates." : "No reviewed market data is visible for these companies yet, so their dates are not shown."} />
      <CoList title="Not covered" cos={cal.notCovered} note="Primary listing outside the US. Finnhub's free plan covers US listings only, so no dates are stored for these companies." />
      <p className="muted mono" style={{ fontSize: 11, marginTop: 16 }}>
        Source: Finnhub earnings calendar, stored per company{fetched.length ? `, fetched ${fetched.map(dayLabel).join(", ")}` : ""}. {shown} report{shown === 1 ? "" : "s"} shown. Two different dates for one company within 30 days are both flagged "dates conflict, unverified" until one is rejected. No estimates are shown.
      </p>
    </main>
  );
}
