// Earnings-day reaction (GRF-20). Pure functions: no data access here.
// A report date comes from a reviewed SEC 8-K item 2.02 filing (source = the filing link, detail = quarter, timing and the exact
// acceptance time). Which trading day reacted is read from the acceptance time in New York, never guessed:
//   accepted before 09:30 ET -> that day's close against the previous trading day's close
//   accepted at or after 16:00 ET -> the next trading day's close against that day's close
//   accepted during market hours -> flagged and not shown: part of the day traded before the report
// A stored close more than GAP_DAYS calendar days from the report is flagged too: the trading days between are missing from the
// store, so "the next stored close" would not be the next trading day.
// A missing date or close is said in words; no move is estimated or carried over.

export type Timing = "before_open" | "after_close" | "market_hours";
export const TIMING_WORDS: Record<Timing, string> = { before_open: "before market open", after_close: "after market close", market_hours: "during market hours" };
export const SEC_SOURCE = /^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\//;

const NY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** New York date and minutes after midnight for a UTC instant (daylight saving included). */
export function nyParts(isoUtc: string): { date: string; minutes: number; time: string } {
  const p = Object.fromEntries(NY.formatToParts(new Date(isoUtc)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute), time: `${p.hour}:${p.minute}` };
}

export function timingOf(isoUtc: string): Timing {
  const m = nyParts(isoUtc).minutes;
  return m < 9 * 60 + 30 ? "before_open" : m >= 16 * 60 ? "after_close" : "market_hours";
}

/** The detail stored with a staged SEC row: "Q3 2026, before market open; 8-K accepted 2026-11-04T11:55:00Z". */
export const secDetail = (quarter: string, acceptedUtc: string) => `${quarter}, ${TIMING_WORDS[timingOf(acceptedUtc)]}; 8-K accepted ${acceptedUtc}`;

/** Reads a stored SEC row back. Null when the row is not one (another source, or no acceptance time in the detail). */
export function parseSecEvent(source: string, detail: string | null): { quarter: string; acceptedUtc: string; url: string } | null {
  if (!SEC_SOURCE.test(source)) return null;
  const m = detail?.match(/^(.+?), [a-z ]+; 8-K accepted (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)$/);
  return m ? { quarter: m[1], acceptedUtc: m[2], url: source } : null;
}

export const GAP_DAYS = 4; // longest weekend plus holiday, as in around-core
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);

export type Reaction =
  | { kind: "day"; day: string; prev: string; timing: Timing; rule: string }
  | { kind: "flag"; timing: Timing; reason: string };

/** Which trading day's close reacted to a report accepted at `acceptedUtc`. `tradingDays`: New York trading dates with stored
 *  closes, any order. A day the store has not reached yet is flagged, never filled in. */
export function reactionDay(acceptedUtc: string, tradingDays: string[]): Reaction {
  const days = [...new Set(tradingDays)].sort();
  const { date, time } = nyParts(acceptedUtc);
  const timing = timingOf(acceptedUtc);
  if (timing === "market_hours") return { kind: "flag", timing, reason: `Accepted at ${time} ET, during market hours: part of that day traded before the report, so no reaction day is shown` };
  const before = (d: string) => days.filter((x) => x < d).at(-1);
  const after = (d: string) => days.find((x) => x > d);
  let day: string | undefined, prev: string | undefined, rule: string;
  if (timing === "before_open" && days.includes(date)) {
    day = date; prev = before(date); rule = `accepted ${time} ET, before the open: ${date} against the previous close`;
  } else {
    // After the close, or before the open on a day with no trading: the next trading day reacts.
    day = after(date); prev = days.filter((x) => x <= date).at(-1);
    rule = timing === "after_close" ? `accepted ${time} ET, after the close: next trading day against ${date}'s close` : `accepted ${time} ET on ${date}, not a trading day: next trading day against the last close`;
  }
  if (!day) return { kind: "flag", timing, reason: `The trading day after the report (${date}) has no stored close yet` };
  if (!prev) return { kind: "flag", timing, reason: `No stored close before ${day}` };
  if (daysBetween(date, day) > GAP_DAYS) return { kind: "flag", timing, reason: `The next stored close after the report (${date}) is ${day}; the trading days between are not stored` };
  if (daysBetween(prev, day) > GAP_DAYS) return { kind: "flag", timing, reason: `The stored close before ${day} is ${prev}; the trading days between are not stored` };
  return { kind: "day", day, prev, timing, rule };
}

export type Move = { pct: number } | { missing: string };

/** One company's move on a reaction day, from its own stored closes (date -> close). */
export function moveOn(closes: Map<string, number>, r: Reaction): Move {
  if (r.kind === "flag") return { missing: r.reason };
  const a = closes.get(r.prev), b = closes.get(r.day);
  if (a == null && b == null) return { missing: `No stored closes for ${r.prev} or ${r.day}` };
  if (a == null || !(a > 0)) return { missing: `No stored close for ${r.prev}` };
  if (b == null) return { missing: `No stored close for ${r.day}` };
  return { pct: ((b - a) / a) * 100 };
}

/** The focal company's last `n` report dates from promoted SEC rows, newest first; one per date. */
export function lastReports<T extends { event_date: string; source: string; detail: string | null }>(rows: T[], n = 4) {
  const seen = new Set<string>();
  return rows
    .map((r) => ({ r, sec: parseSecEvent(r.source, r.detail) }))
    .filter((x): x is { r: T; sec: NonNullable<ReturnType<typeof parseSecEvent>> } => !!x.sec)
    .sort((a, b) => b.r.event_date.localeCompare(a.r.event_date))
    .filter((x) => (seen.has(x.r.event_date) ? false : (seen.add(x.r.event_date), true)))
    .slice(0, n)
    .map((x) => ({ date: x.r.event_date, ...x.sec }));
}

export type ReportCol = { date: string; quarter: string; url: string; reaction: Reaction };
export type ReactionRow<C> = { co: C; focal: boolean; moves: Move[] };

/** The table: one column per report (newest first), one row per company with stored closes (the focal company first); companies
 *  with no stored close in any column are counted, not listed. Trading days are the dates any of these companies has a close. */
export function reactionTable<C extends { id: number; name: string }>(reports: ReturnType<typeof lastReports>, focal: C, linked: C[], closes: Map<number, Map<string, number>>) {
  const tradingDays = [...new Set([...closes.values()].flatMap((m) => [...m.keys()]))];
  const cols: ReportCol[] = reports.map((r) => ({ date: r.date, quarter: r.quarter, url: r.url, reaction: reactionDay(r.acceptedUtc, tradingDays) }));
  const rowOf = (co: C, isFocal: boolean): ReactionRow<C> => ({ co, focal: isFocal, moves: cols.map((c) => moveOn(closes.get(co.id) ?? new Map(), c.reaction)) });
  const others = linked.filter((c) => c.id !== focal.id).sort((a, b) => a.name.localeCompare(b.name));
  const priced = others.filter((c) => (closes.get(c.id)?.size ?? 0) > 0);
  return { cols, rows: [rowOf(focal, true), ...priced.map((c) => rowOf(c, false))], unpriced: others.length - priced.length };
}
