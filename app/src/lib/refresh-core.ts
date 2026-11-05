// Daily market-data refresh rules (DEM-1, DEM-3, TRM-13). Pure functions: no data access, so tests can run them directly.
// Market data (closes, ratios, earnings dates) is promoted automatically, with guards; links are never touched here.
// Admin-approved rule change, Nov 4 2026: see CLAUDE.md rule 4.

// The refresh reads, plans and writes earnings rows of its own source only. Rows from other sources (the SEC 8-K report dates
// staged for review, GRF-20) are never read here, so the refresh can neither touch, reject nor overwrite them.
export const REFRESH_SOURCE = "finnhub";
export const refreshOwns = (row: { source: string }) => row.source === REFRESH_SOURCE;

export type StoredEvent = { id: number; event_date: string; detail: string | null; status: "staged" | "promoted" | "rejected" };
export type CalendarEntry = { date: string; quarter: number | null; year: number | null; hour: string | null; reported: boolean };

export type EventAction =
  | { kind: "skip"; reason: string; date: string }
  | { kind: "touch"; id: number; date: string; detail: string | null } // same promoted date: refresh detail and fetched_at
  | { kind: "insert"; date: string; detail: string | null; status: "promoted" | "staged"; reason: string };

const HOUR: Record<string, string> = { bmo: "before market open", amc: "after market close", dmh: "during market hours" };

export const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);

export function detailOf(e: CalendarEntry): string | null {
  const bits: string[] = [];
  if (e.quarter && e.year) bits.push(`Q${e.quarter} ${e.year}`);
  if (e.hour && HOUR[e.hour]) bits.push(HOUR[e.hour]);
  return bits.length ? bits.join(", ") : null;
}

/** "Q3 2026" from a stored detail or a calendar entry, so two dates for one report can be matched. */
export const quarterKey = (detail: string | null | undefined): string | null => detail?.match(/Q[1-4] \d{4}/)?.[0] ?? null;

/**
 * Decide what to do with each earnings date the calendar lists for one company.
 * - A date the admin rejected is never brought back (fixes the re-staging bug logged Oct 29).
 * - A promoted row for the same date is refreshed in place.
 * - The same quarter already promoted on another date: the new date is staged for review and the published one stays.
 * - A new quarter is promoted, unless a staged row already holds that date (left for review).
 */
export function planEvents(stored: StoredEvent[], cal: CalendarEntry[]): EventAction[] {
  const out: EventAction[] = [];
  const used = new Set<number>();
  for (const e of cal) {
    const detail = detailOf(e);
    if (stored.some((s) => s.status === "rejected" && s.event_date === e.date)) { out.push({ kind: "skip", reason: "rejected by admin", date: e.date }); continue; }
    const same = stored.find((s) => s.status === "promoted" && s.event_date === e.date);
    if (same) { used.add(same.id); out.push({ kind: "touch", id: same.id, date: e.date, detail: detail ?? same.detail }); continue; }
    if (stored.some((s) => s.status === "staged" && s.event_date === e.date)) { out.push({ kind: "skip", reason: "already staged for review", date: e.date }); continue; }
    const qk = quarterKey(detail);
    const sameQuarter = qk ? stored.find((s) => s.status === "promoted" && !used.has(s.id) && quarterKey(s.detail) === qk) : undefined;
    if (sameQuarter) {
      // Any change to a date already published waits for the admin: the calendar service has listed wrong dates
      // (DoorDash Q3 2026 showed Oct 29 on Nov 4, the day the company had announced). The old date stays live meanwhile.
      const gap = daysBetween(sameQuarter.event_date, e.date);
      out.push({ kind: "insert", date: e.date, detail, status: "staged", reason: `${qk} listed on ${e.date}, ${Math.abs(gap)} days ${gap < 0 ? "earlier" : "later"} than the published ${sameQuarter.event_date}; needs review` });
      continue;
    }
    out.push({ kind: "insert", date: e.date, detail, status: "promoted", reason: "new report date" });
  }
  return out;
}

/** Finnhub /calendar/earnings rows to CalendarEntry. A row with an actual EPS has been reported. */
export function parseCalendar(rows: unknown): CalendarEntry[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((r) => {
    const x = r as { date?: string; quarter?: number; year?: number; hour?: string; epsActual?: number | null; revenueActual?: number | null };
    if (!x?.date || !/^\d{4}-\d{2}-\d{2}$/.test(x.date)) return [];
    return [{ date: x.date, quarter: x.quarter ?? null, year: x.year ?? null, hour: x.hour || null, reported: x.epsActual != null || x.revenueActual != null }];
  });
}

/** Finnhub /stock/metric + /stock/recommendation to a company_metrics row; null when the metric call gave nothing. */
export function metricsRow(metric: unknown, recs: unknown): Record<string, number | string | null> | null {
  const m = ((metric as { metric?: Record<string, unknown> })?.metric) ?? {};
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  if (!Object.keys(m).length) return null;
  const list = Array.isArray(recs) ? (recs as { period?: string; strongBuy?: number; buy?: number; hold?: number; sell?: number; strongSell?: number }[]) : [];
  const latest = list.reduce<(typeof list)[number] | null>((a, r) => (!a || (r.period ?? "") > (a.period ?? "") ? r : a), null);
  const series = ((metric as { series?: { quarterly?: Record<string, { period?: string }[]> } })?.series?.quarterly) ?? {};
  const periods = Object.values(series).map((s) => s?.[0]?.period).filter((p): p is string => !!p);
  return {
    pe_ttm: n(m.peTTM), ev_ebitda: n(m.evEbitdaTTM), gross_margin: n(m.grossMarginTTM), operating_margin: n(m.operatingMarginTTM),
    net_margin: n(m.netProfitMarginTTM), revenue_growth_yoy: n(m.revenueGrowthTTMYoy), debt_to_equity: n(m["totalDebt/totalEquityQuarterly"]),
    data_period: periods.length ? periods.sort().at(-1)! : null,
    rec_period: latest?.period ?? null, rec_strong_buy: n(latest?.strongBuy), rec_buy: n(latest?.buy), rec_hold: n(latest?.hold), rec_sell: n(latest?.sell), rec_strong_sell: n(latest?.strongSell),
  };
}
