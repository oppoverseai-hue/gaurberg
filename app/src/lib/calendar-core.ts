// Earnings calendar rules (TRM-13, UX-4, GRF-20). Pure functions: no data access here.
// Upcoming dates are promoted Finnhub rows only. A staged Finnhub row dated today or later is a date change under review: it is
// counted and flags its company, but its date is never shown. Companies without a date are listed with a stated reason, never hidden.
import { shortName } from "./about-core.ts";

export type CalCo = { id: number; ticker: string | null; name: string; markets: string[] | null; segment: string | null };
export type CalEvent = { company_id: number; event_date: string; detail: string | null; status: string; fetched_at: string };
export type Timing = "before" | "after" | "during" | "none";
export type CalRow = { co: CalCo; date: string; quarter: string | null; timing: Timing; underReview: boolean; links: number; fetched_at: string };
export type Reasoned = { co: CalCo; reason: string };
export type Range = 30 | 60 | 90 | "all";
export type TimingFilter = "all" | "before" | "after" | "none";
export type Filter = { range: Range; q: string; timing: TimingFilter };

export const RANGES: Range[] = [30, 60, 90, "all"];
export const HORIZON = 90; // days checked for "No date in the next 90 days"

export const TIMING_LABEL: Record<Timing, string> = { before: "Before open", after: "After close", during: "During market hours", none: "Time not given" };
export const TIMING_HOVER: Record<Timing, string> = {
  before: "Before the market opens (BMO)", after: "After the market closes (AMC)", during: "During market hours (DMH)", none: "Finnhub gives no time for this report",
};
const TIMES: Record<string, Timing> = { "before market open": "before", "after market close": "after", "during market hours": "during" };

export const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
export const dayShort = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

// The loader writes detail as "Q3 2026, after market close"; either part may be missing.
export function splitDetail(d: string | null): { quarter: string | null; timing: Timing } {
  const parts = (d ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const t = parts.map((p) => TIMES[p]).find(Boolean);
  return { quarter: parts.find((p) => /^Q[1-4] \d{4}$/.test(p)) ?? null, timing: t ?? "none" };
}

export function weekStart(d: string): string {
  const dow = new Date(`${d}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(d, -((dow + 6) % 7));
}

export type CalInput = {
  cos: CalCo[];
  events: CalEvent[]; // promoted and staged Finnhub earnings rows dated today or later
  links: Record<number, number>; // reviewed (promoted) links per company
  secIds: number[]; // companies with a promoted SEC 8-K item 2.02 report date
  loadedIds: number[]; // companies with a visible company_metrics row
  isCovered: (c: CalCo) => boolean; // main listing in the US
  today: string;
};
export type Prepared = { rows: CalRow[]; staged: { co: CalCo; date: string }[]; noDate: Reasoned[]; notCovered: Reasoned[] };

export function prepare(inp: CalInput): Prepared {
  const { today } = inp;
  const horizon = addDays(today, HORIZON);
  const byId = new Map(inp.cos.map((c) => [c.id, c]));
  const future = inp.events.filter((e) => e.event_date >= today && byId.has(e.company_id));
  const staged = future.filter((e) => e.status === "staged").map((e) => ({ co: byId.get(e.company_id)!, date: e.event_date }));
  const stagedIds = new Set(staged.map((s) => s.co.id));
  const seen = new Set<string>();
  const rows: CalRow[] = [];
  for (const e of future) {
    if (e.status !== "promoted" || seen.has(`${e.company_id}|${e.event_date}`)) continue;
    seen.add(`${e.company_id}|${e.event_date}`);
    const co = byId.get(e.company_id)!;
    rows.push({ co, date: e.event_date, ...splitDetail(e.detail), underReview: stagedIds.has(co.id), links: inp.links[co.id] ?? 0, fetched_at: e.fetched_at });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.co.name.localeCompare(b.co.name));
  const sec = new Set(inp.secIds), loaded = new Set(inp.loadedIds);
  const noDate: Reasoned[] = [], notCovered: Reasoned[] = [];
  for (const co of inp.cos) {
    if (!co.ticker) { notCovered.push({ co, reason: "No ticker" }); continue; }
    if (!inp.isCovered(co)) { notCovered.push({ co, reason: `Main listing outside the US${co.markets?.[0] ? ` (${co.markets[0]})` : ""}; Finnhub's free plan covers US listings only` }); continue; }
    const mine = rows.filter((r) => r.co.id === co.id);
    if (mine.some((r) => r.date <= horizon)) continue;
    if (stagedIds.has(co.id)) { noDate.push({ co, reason: "Staged, not reviewed" }); continue; }
    const reason = !loaded.has(co.id) ? "Market data not loaded yet" : mine.length ? `Next date Finnhub lists: ${dayShort(mine[0].date)}` : "Finnhub lists no date";
    noDate.push({ co, reason: sec.has(co.id) ? reason : `${reason}; files no 8-K item 2.02` });
  }
  const byName = (a: Reasoned, b: Reasoned) => a.co.name.localeCompare(b.co.name);
  return { rows, staged, noDate: noDate.sort(byName), notCovered: notCovered.sort(byName) };
}

export const inRange = (date: string, today: string, range: Range) => date >= today && (range === "all" || date <= addDays(today, range));
export function matchesQuery(co: CalCo, q: string): boolean {
  const s = q.trim().toLowerCase();
  return !s || [co.name, co.ticker ?? "", co.segment ?? ""].some((v) => v.toLowerCase().includes(s));
}
const matchesTiming = (t: Timing, f: TimingFilter) => f === "all" || t === f;

// Rows in the range that pass the search and timing filters; "later" is each other company's next date within 90 days.
export function applyFilter(rows: CalRow[], today: string, f: Filter): { shown: CalRow[]; later: CalRow[] } {
  const pass = rows.filter((r) => matchesQuery(r.co, f.q) && matchesTiming(r.timing, f.timing));
  const shown = pass.filter((r) => inRange(r.date, today, f.range));
  const done = new Set(shown.map((r) => r.co.id));
  const later: CalRow[] = [];
  for (const r of pass) {
    if (done.has(r.co.id) || inRange(r.date, today, f.range) || !inRange(r.date, today, HORIZON)) continue;
    done.add(r.co.id);
    later.push(r);
  }
  return { shown, later };
}

export function rangeCounts(rows: CalRow[], today: string, f: Omit<Filter, "range">): Record<string, number> {
  return Object.fromEntries(RANGES.map((range) => [String(range), applyFilter(rows, today, { ...f, range }).shown.length]));
}

export type Summary = { scheduled: number; before: number; after: number; none: number; underReview: number };
// Every number follows the filters shown. Date changes under review: staged rows in the same range for companies matching the search
// (with no search and "All", every staged Finnhub row dated today or later).
export function summarize(shown: CalRow[], staged: Prepared["staged"], today: string, f: Filter): Summary {
  const n = (t: Timing) => shown.filter((r) => r.timing === t).length;
  return {
    scheduled: shown.length, before: n("before"), after: n("after"), none: n("none"),
    underReview: staged.filter((s) => inRange(s.date, today, f.range) && matchesQuery(s.co, f.q)).length,
  };
}

export type Week = { start: string; count: number; days: { date: string; rows: CalRow[] }[] };
// Weeks start on Monday. A week with no rows is not listed.
export function groupWeeks(rows: CalRow[]): Week[] {
  const weeks: Week[] = [];
  for (const r of [...rows].sort((a, b) => a.date.localeCompare(b.date) || a.co.name.localeCompare(b.co.name))) {
    const start = weekStart(r.date);
    if (weeks.at(-1)?.start !== start) weeks.push({ start, count: 0, days: [] });
    const w = weeks.at(-1)!;
    if (w.days.at(-1)?.date !== r.date) w.days.push({ date: r.date, rows: [] });
    w.days.at(-1)!.rows.push(r);
    w.count++;
  }
  return weeks;
}

export const short = (co: CalCo) => shortName(co.name);

// CSV of the rows shown. A cell a spreadsheet would read as a formula gets a leading apostrophe.
export function toCSV(rows: CalRow[]): string {
  const cell = (v: string | number) => {
    let s = String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = ["date", "ticker", "company", "segment", "quarter", "timing", "date_under_review", "reviewed_links", "source"];
  const body = rows.map((r) => [r.date, r.co.ticker ?? "", r.co.name, r.co.segment ?? "", r.quarter ?? "", TIMING_LABEL[r.timing], r.underReview ? "yes" : "no", r.links, "Finnhub earnings calendar"].map(cell).join(","));
  return [head.join(","), ...body].join("\r\n") + "\r\n";
}

// iCalendar (RFC 5545) of the rows shown. All-day events: no clock time is ever written. The UID is the company and quarter
// (the date when no quarter is given), so a moved date updates the same event.
export const icsEscape = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r\n|\r|\n/g, "\\n");
const enc = new TextEncoder();
function fold(line: string): string {
  const out: string[] = [];
  let cur = "", bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > (out.length ? 74 : 75)) { out.push(cur); cur = ""; bytes = 0; }
    cur += ch; bytes += b;
  }
  out.push(cur);
  return out.join("\r\n ");
}
const compact = (d: string) => d.replace(/-/g, "");
export function icsSummary(r: CalRow): string {
  return `${r.co.name}${r.quarter ? ` ${r.quarter}` : ""} earnings (${TIMING_LABEL[r.timing].toLowerCase()})`;
}
export function toICS(rows: CalRow[], nowUtc: string): string {
  const stamp = nowUtc.replace(/[-:]/g, "").replace(/\.\d+/, "").slice(0, 15) + "Z";
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Gaurberg//Earnings calendar//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const r of rows) {
    const key = (r.co.ticker ?? `co${r.co.id}`).replace(/[^A-Za-z0-9.]/g, "");
    lines.push("BEGIN:VEVENT",
      `UID:${key}-${r.quarter ? r.quarter.replace(" ", "-") : compact(r.date)}-earnings@gaurberg`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(r.date)}`,
      `DTEND;VALUE=DATE:${compact(addDays(r.date, 1))}`,
      `SUMMARY:${icsEscape(icsSummary(r))}`,
      `DESCRIPTION:${icsEscape(`Date from Finnhub's earnings calendar. Not company-confirmed until the SEC 8-K appears.${r.underReview ? " A date change is under review." : ""}`)}`,
      "TRANSP:TRANSPARENT", "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
