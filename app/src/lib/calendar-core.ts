// Events calendar rules (TRM-13). Pure functions: no data access here.
// Upcoming earnings for every mapped company, grouped by week (weeks start on Monday). Companies without a date are listed,
// never hidden, split by why: checked and no date in the next 90 days, not loaded yet (nothing visible to this viewer),
// or not covered (Finnhub's free plan has US listings only).
import { upcomingByCompany, type EventRow } from "./metrics-core";

export type CalCo = { id: number; ticker: string; name: string; markets: string[] | null };
export type CalRow = { c: CalCo; date: string; quarter: string | null; time: string | null; status: string; conflict: boolean; fetched_at: string };
export type Calendar = { weeks: { start: string; rows: CalRow[] }[]; later: { c: CalCo; date: string }[]; noDate: CalCo[]; notLoaded: CalCo[]; notCovered: CalCo[] };
export const WINDOWS = [30, 60, 90] as const;
export const HORIZON = 90; // days checked for "no date"; conflicts are judged over this whole horizon, whatever window is shown

const TIMES = ["before market open", "after market close", "during market hours"];
// The loader writes detail as "Q3 2026, after market close"; either part may be missing.
export function splitDetail(d: string | null): { quarter: string | null; time: string | null } {
  const parts = (d ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const time = parts.find((p) => TIMES.includes(p)) ?? null;
  const quarter = parts.find((p) => /^Q[1-4] \d{4}$/.test(p)) ?? null;
  return { quarter, time };
}

const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
export function weekStart(d: string): string {
  const dow = new Date(`${d}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(d, -((dow + 6) % 7));
}

// loadedIds: companies whose market data this viewer can see (a stored metrics row), i.e. their calendar was checked.
export function buildCalendar(cos: CalCo[], events: EventRow[], loadedIds: Set<number>, isCovered: (c: CalCo) => boolean, today: string, windowDays: number): Calendar {
  const up = upcomingByCompany(events, today, addDays(today, HORIZON));
  const until = addDays(today, windowDays);
  const rows: CalRow[] = [];
  const noDate: CalCo[] = [], notLoaded: CalCo[] = [], notCovered: CalCo[] = [], later: { c: CalCo; date: string }[] = [];
  for (const c of cos) {
    const list = up.get(c.id) ?? [];
    const shown = list.filter((u) => u.date <= until);
    shown.forEach((u) => rows.push({ c, date: u.date, ...splitDetail(u.detail), status: u.status, conflict: u.conflict, fetched_at: u.fetched_at }));
    if (list.length && !shown.length) later.push({ c, date: list[0].date }); // next date is past the window shown but within 90 days
    if (list.length) continue;
    if (!isCovered(c)) notCovered.push(c);
    else if (!loadedIds.has(c.id)) notLoaded.push(c);
    else noDate.push(c);
  }
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.c.name.localeCompare(b.c.name));
  const weeks: Calendar["weeks"] = [];
  for (const r of rows) {
    const w = weekStart(r.date);
    if (weeks.at(-1)?.start !== w) weeks.push({ start: w, rows: [] });
    weeks.at(-1)!.rows.push(r);
  }
  const byName = (a: CalCo, b: CalCo) => a.name.localeCompare(b.name);
  later.sort((a, b) => a.date.localeCompare(b.date) || a.c.name.localeCompare(b.c.name));
  return { weeks, later, noDate: noDate.sort(byName), notLoaded: notLoaded.sort(byName), notCovered: notCovered.sort(byName) };
}
