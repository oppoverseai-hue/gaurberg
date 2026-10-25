// Shared display and selection rules for stored market data (DEM-1, TRM-12). Pure functions: no data access here.
// Rows come through row-level security, so an allowed user only ever passes promoted rows and the admin also passes staged ones.

export type MetricRow = {
  company_id: number; as_of: string; data_period: string | null;
  pe_ttm: number | null; ev_ebitda: number | null; operating_margin: number | null; net_margin: number | null;
  revenue_growth_yoy: number | null; debt_to_equity: number | null;
  rec_period: string | null; rec_strong_buy: number | null; rec_buy: number | null; rec_hold: number | null; rec_sell: number | null; rec_strong_sell: number | null;
  source: string; fetched_at: string; status: string; note: string | null;
};
export type EventRow = { company_id: number; event_date: string; event_type: string; detail: string | null; source: string; fetched_at: string; status: string };

const NUMS = ["pe_ttm", "ev_ebitda", "operating_margin", "net_margin", "revenue_growth_yoy", "debt_to_equity", "rec_strong_buy", "rec_buy", "rec_hold", "rec_sell", "rec_strong_sell"] as const;
// Numeric columns can arrive as strings from the database; blanks stay null, never 0.
export function cleanMetric(r: MetricRow): MetricRow {
  const m = { ...r };
  for (const k of NUMS) m[k] = m[k] == null ? null : Number(m[k]);
  return m;
}

// Margins and growth beyond +/-1,000% are not meaningful: shown as n/m, with the stored value in the tooltip. Stored data is unchanged.
export const NM_LIMIT = 1000;
export function pctCell(v: number | null): { text: string | null; tip?: string } {
  if (v == null) return { text: null };
  const t = `${v.toFixed(1)}%`;
  return Math.abs(v) > NM_LIMIT ? { text: "n/m", tip: `${t} as reported by Finnhub; not meaningful beyond ±1,000%` } : { text: t };
}

// Latest visible row per company: newest as-of date, and on the same date a promoted row before a staged one.
export function latestMetrics(rows: MetricRow[]): Map<number, MetricRow> {
  const out = new Map<number, MetricRow>();
  for (const r of rows.map(cleanMetric)) {
    const o = out.get(r.company_id);
    if (!o || r.as_of > o.as_of || (r.as_of === o.as_of && o.status !== "promoted" && r.status === "promoted")) out.set(r.company_id, r);
  }
  return out;
}

export type Recs = { buy: number; hold: number; sell: number; detail: string; period: string };
export function recs(m: MetricRow | null): Recs | null {
  if (!m || m.rec_period == null || [m.rec_strong_buy, m.rec_buy, m.rec_hold, m.rec_sell, m.rec_strong_sell].every((v) => v == null)) return null;
  const n = (v: number | null) => v ?? 0; // a count Finnhub left out of an otherwise reported month counts as none
  return {
    buy: n(m.rec_strong_buy) + n(m.rec_buy), hold: n(m.rec_hold), sell: n(m.rec_sell) + n(m.rec_strong_sell), period: m.rec_period,
    detail: `Strong buy ${m.rec_strong_buy ?? "–"} · Buy ${m.rec_buy ?? "–"} · Hold ${m.rec_hold ?? "–"} · Sell ${m.rec_sell ?? "–"} · Strong sell ${m.rec_strong_sell ?? "–"}`,
  };
}

// Upcoming earnings per company. Each date shows once (a promoted row before its staged copy). Two different dates within
// CONFLICT_DAYS of each other cannot both be the next report: both are flagged "dates conflict, unverified" until one is rejected.
export const CONFLICT_DAYS = 30;
export type Upcoming = { date: string; detail: string | null; status: string; fetched_at: string; conflict: boolean };
const days = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86400000;

export function upcomingByCompany(rows: EventRow[], today: string, untilDate?: string): Map<number, Upcoming[]> {
  const by = new Map<number, Map<string, EventRow>>();
  for (const e of rows) {
    if (e.event_type !== "earnings" || e.status === "rejected" || e.event_date < today || (untilDate && e.event_date > untilDate)) continue;
    const m = by.get(e.company_id) ?? new Map<string, EventRow>();
    const o = m.get(e.event_date);
    if (!o || (o.status !== "promoted" && e.status === "promoted")) m.set(e.event_date, e);
    by.set(e.company_id, m);
  }
  const out = new Map<number, Upcoming[]>();
  for (const [id, m] of by) {
    const list = [...m.values()].sort((a, b) => a.event_date.localeCompare(b.event_date));
    out.set(id, list.map((e, i) => ({
      date: e.event_date, detail: e.detail, status: e.status, fetched_at: e.fetched_at,
      conflict: list.some((o, j) => j !== i && days(o.event_date, e.event_date) <= CONFLICT_DAYS),
    })));
  }
  return out;
}

export const UNCLASSIFIED = "unclassified";
export const groupOf = (v: string | null | undefined) => (v && v.trim() ? v : UNCLASSIFIED);
export const dayLabel = (d: string) => new Date(d.length === 10 ? `${d}T00:00:00Z` : d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
