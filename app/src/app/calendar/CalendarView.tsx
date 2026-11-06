"use client";
// Earnings calendar view (TRM-13, UX-4, GRF-20). Filters, weeks and exports run in the browser on the rows the server read.
// Links to other companies' pages here are prefetch={false}: a long list would prefetch every page it shows (item 25). The tab bar,
// breadcrumb and header keep the default prefetch.
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  RANGES, HORIZON, TIMING_LABEL, TIMING_HOVER, applyFilter, rangeCounts, summarize, groupWeeks, dayShort, short, toCSV, toICS,
  type Prepared, type Range, type TimingFilter, type CalRow,
} from "@/lib/calendar-core";

const weekday = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const TIMING_FILTERS: TimingFilter[] = ["all", "before", "after", "none"];

function download(name: string, type: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Row({ r, review }: { r: CalRow; review: boolean }) {
  const t = r.co.ticker ?? "";
  return (
    <li className="cal-row">
      <span className="cal-tile mono" aria-hidden="true">{t.slice(0, 4)}</span>
      <span className="cal-co"><strong className="cal-full">{r.co.name}</strong><strong className="cal-short">{short(r.co)}</strong> <span className="muted mono">{t}</span></span>
      <span className="cal-q mono muted">{r.quarter ?? "Quarter not given"}</span>
      <span className="cal-chips">
        <span className={`cal-chip mono${r.timing === "none" ? " muted" : ""}`} title={TIMING_HOVER[r.timing]}>{TIMING_LABEL[r.timing]}</span>
        {review && r.underReview && <span className="cal-chip cal-review mono" title="A different date from Finnhub is staged and waiting for the admin's review. The date shown is the reviewed one.">Date under review</span>}
      </span>
      <span className="cal-links mono muted" title="Reviewed links in the graph">{r.links} reviewed link{r.links === 1 ? "" : "s"}</span>
      <Link className="chip cal-open" href={`/company/${t}/earnings`} prefetch={false} aria-label={`Open ${r.co.name} earnings`}>Open</Link>
    </li>
  );
}

function Reasons({ title, items }: { title: string; items: Prepared["noDate"] }) {
  if (!items.length) return null;
  return (
    <details className="card cal-none">
      <summary><strong>{title}</strong> <span className="muted">({items.length})</span></summary>
      <ul className="cal-reasons">
        {items.map((x) => (
          <li key={x.co.id}>
            {x.co.ticker ? <Link href={`/company/${x.co.ticker}`} prefetch={false}>{x.co.name}</Link> : <span>{x.co.name}</span>}
            {x.co.ticker && <span className="muted mono"> {x.co.ticker}</span>}
            <span className="muted"> · {x.reason}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

// review: the admin's view. Only then were staged rows read, and only then are the review tile, chips and CSV column shown.
export default function CalendarView({ data, today, review, initialRange, notice }: { data: Prepared; today: string; review: boolean; initialRange: Range; notice: string | null }) {
  const [range, setRange] = useState<Range>(initialRange);
  const [q, setQ] = useState("");
  const [timing, setTiming] = useState<TimingFilter>("all");
  const f = { range, q, timing };
  const { shown, later } = useMemo(() => applyFilter(data.rows, today, { range, q, timing }), [data.rows, today, range, q, timing]);
  const counts = useMemo(() => rangeCounts(data.rows, today, { q, timing }), [data.rows, today, q, timing]);
  const sum = summarize(shown, data.staged, today, f);
  const weeks = groupWeeks(shown);
  const stamp = today;

  return (
    <>
      <div className="cal-controls" role="group" aria-label="Filters">
        <div className="scr-scope cal-seg" role="group" aria-label="Range">
          {RANGES.map((r) => (
            <button key={String(r)} type="button" className={r === range ? "on" : ""} aria-pressed={r === range} onClick={() => setRange(r)}>
              {r === "all" ? "All" : `${r} days`} <span className="cal-n">{counts[String(r)]}</span>
            </button>
          ))}
        </div>
        <input className="cal-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Company, ticker, segment" aria-label="Search company, ticker or segment" />
        <div className="scr-scope cal-seg" role="group" aria-label="Timing">
          {TIMING_FILTERS.map((t) => (
            <button key={t} type="button" className={t === timing ? "on" : ""} aria-pressed={t === timing} onClick={() => setTiming(t)} title={t === "all" ? "Every timing" : TIMING_HOVER[t]}>
              {t === "all" ? "All" : TIMING_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      {notice && <p className="savedbar" style={{ marginTop: 16 }}>{notice}</p>}

      <div className="cal-sum">
        <div><span className="label">Scheduled</span><b className="mono">{sum.scheduled}</b></div>
        <div><span className="label" title={TIMING_HOVER.before}>Before open</span><b className="mono">{sum.before}</b></div>
        <div><span className="label" title={TIMING_HOVER.after}>After close</span><b className="mono">{sum.after}</b></div>
        <div><span className="label">Time not given</span><b className="mono">{sum.none}</b></div>
        {review && (
          <div>
            <span className="label" title="Different dates from Finnhub that are staged and wait for your review">Date changes under review</span>
            <b className="mono">{sum.underReview > 0 ? <Link href="/admin">{sum.underReview}</Link> : 0}</b>
          </div>
        )}
        <div className="cal-export">
          <button type="button" className="chip" disabled={!shown.length} onClick={() => download(`gaurberg-earnings-${stamp}.csv`, "text/csv;charset=utf-8", toCSV(shown, review))}>CSV</button>
          <button type="button" className="chip" disabled={!shown.length} onClick={() => download(`gaurberg-earnings-${stamp}.ics`, "text/calendar;charset=utf-8", toICS(shown, new Date().toISOString()))}>iCal</button>
        </div>
      </div>

      {weeks.length === 0 ? (
        <div className="card" style={{ marginTop: 16 }}><p className="muted" style={{ margin: 0 }}>No reports match{range === "all" ? "" : ` in the next ${range} days`}.</p></div>
      ) : weeks.map((w, i) => (
        <details key={w.start} className="card cal-week" open={i < 2}>
          <summary className="cardhead"><h3>Week of {dayShort(w.start)}</h3><span className="label">{w.count} report{w.count === 1 ? "" : "s"}</span></summary>
          {w.days.map((d) => (
            <div key={d.date} className="cal-day">
              <p className="cal-dayhead mono">{weekday(d.date)}{d.date === today ? " · today" : ""}</p>
              <ul className="cal-rows">{d.rows.map((r) => <Row key={`${r.co.id}-${r.date}`} r={r} review={review} />)}</ul>
            </div>
          ))}
        </details>
      ))}

      {later.length > 0 && (
        <section className="card cal-later">
          <div className="cardhead"><h3>Later in the next {HORIZON} days</h3><span className="label">{later.length}</span></div>
          <ul>
            {later.map((r) => (
              <li key={r.co.id}><Link href={`/company/${r.co.ticker}/earnings`} prefetch={false}><span className="mono">{r.co.ticker}</span> {short(r.co)}</Link><span className="mono muted">{dayShort(r.date)}</span></li>
            ))}
          </ul>
        </section>
      )}

      <Reasons title={`No date in the next ${HORIZON} days`} items={data.noDate} />
      <Reasons title="Not covered" items={data.notCovered} />
    </>
  );
}
