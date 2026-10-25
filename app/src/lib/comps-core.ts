// Peer comps rules (TRM-12): filter, sort with blanks always last, and pin up to 5 companies at the top. Pure functions.
import { groupOf, recs, UNCLASSIFIED, type MetricRow, type Upcoming } from "./metrics-core";

export type CompCo = { id: number; ticker: string; name: string; segment: string | null; size_tier: string | null; markets: string[] | null; country?: string | null };
// regions: from the revenue-by-region rows when the company has any ("revenue"), otherwise its HQ country's region ("hq").
// When the rows the report gives cover less than half of revenue, the HQ region is added too ("revenue+hq"), labelled, with no number.
// Never an invented split.
export type RegionBasis = "revenue" | "hq" | "revenue+hq" | null;
export type CompRow = { c: CompCo; m: MetricRow | null; next: Upcoming[]; regions: string[]; regionBasis?: RegionBasis; hqRegion?: string | null; coveragePct?: number | null };
export const PARTIAL_COVER = 50;

/** coveragePct: sum of the stated revenue shares of the rows the report gives (null when any row has no stated share). */
export function regionsFor(revenueRegions: string[], hqRegion: string | null | undefined, coveragePct: number | null = null): { regions: string[]; regionBasis: RegionBasis; hqRegion: string | null; coveragePct: number | null } {
  const hq = hqRegion ?? null;
  if (revenueRegions.length) {
    if (hq && coveragePct != null && coveragePct < PARTIAL_COVER && !revenueRegions.includes(hq)) return { regions: [...revenueRegions, hq], regionBasis: "revenue+hq", hqRegion: hq, coveragePct };
    return { regions: revenueRegions, regionBasis: "revenue", hqRegion: hq, coveragePct };
  }
  return hq ? { regions: [hq], regionBasis: "hq", hqRegion: hq, coveragePct } : { regions: [], regionBasis: null, hqRegion: null, coveragePct };
}

// Sum of stated shares; unknown (null) if there are no rows or any row has no stated share, so coverage is never assumed.
export const coverageOf = (pcts: (number | null)[]) => (pcts.length && pcts.every((p) => p != null) ? Math.round(pcts.reduce((a: number, p) => a + (p as number), 0) * 10) / 10 : null);

export function regionNote(r: Pick<CompRow, "regions" | "regionBasis" | "hqRegion" | "coveragePct">): string {
  switch (r.regionBasis) {
    case "revenue": return `Region: ${r.regions.join(", ")} (revenue split)`;
    case "revenue+hq": return `Region: ${r.regions.filter((g) => g !== r.hqRegion).join(", ")} (revenue split); ${r.hqRegion} (headquarters, added because the reported rows cover ${r.coveragePct}% of revenue)`;
    case "hq": return `Region: ${r.regions[0]} (headquarters; no revenue split loaded)`;
    default: return "Region: not known (no revenue split or headquarters country)";
  }
}
export const SORT_KEYS = ["name", "pe", "ev", "opm", "npm", "growth", "de", "rec", "next"] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export const MAX_PINS = 5;

export function value(r: CompRow, k: SortKey): number | string | null {
  const m = r.m;
  switch (k) {
    case "name": return r.c.name.toLowerCase();
    case "pe": return m?.pe_ttm ?? null;
    case "ev": return m?.ev_ebitda ?? null;
    case "opm": return m?.operating_margin ?? null;
    case "npm": return m?.net_margin ?? null;
    case "growth": return m?.revenue_growth_yoy ?? null;
    case "de": return m?.debt_to_equity ?? null;
    case "rec": { const x = recs(m); const n = x ? x.buy + x.hold + x.sell : 0; return x && n ? x.buy / n : null; } // share of buy ratings
    case "next": return r.next[0]?.date ?? null;
  }
}

// Blanks sort last in both directions; they are never read as 0. Ties fall back to the name.
export function sortRows(rows: CompRow[], k: SortKey, order: "asc" | "desc"): CompRow[] {
  const s = order === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = value(a, k), y = value(b, k);
    if (x == null || y == null) return x == null && y == null ? a.c.name.localeCompare(b.c.name) : x == null ? 1 : -1;
    const d = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
    return s * d || a.c.name.localeCompare(b.c.name);
  });
}

export type CompFilters = { segment: string; size: string; market: string; region: string };
export function matches(r: CompRow, f: CompFilters): boolean {
  return (!f.segment || groupOf(r.c.segment) === f.segment) && (!f.size || groupOf(r.c.size_tier) === f.size)
    && (!f.market || (r.c.markets ?? []).includes(f.market)) && (!f.region || r.regions.includes(f.region));
}

// Pinned companies come first in the order they were pinned, whatever the filters; the rest follow, filtered and sorted.
export function arrange(all: CompRow[], f: CompFilters, pins: string[], k: SortKey, order: "asc" | "desc"): { pinned: CompRow[]; rest: CompRow[] } {
  const by = new Map(all.map((r) => [r.c.ticker.toUpperCase(), r]));
  const pinned = pins.map((t) => by.get(t.toUpperCase())).filter((r): r is CompRow => !!r).slice(0, MAX_PINS);
  const ids = new Set(pinned.map((r) => r.c.id));
  return { pinned, rest: sortRows(all.filter((r) => !ids.has(r.c.id) && matches(r, f)), k, order) };
}

export const parsePins = (v: string | undefined) => [...new Set((v ?? "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean))].slice(0, MAX_PINS);
export { UNCLASSIFIED };
