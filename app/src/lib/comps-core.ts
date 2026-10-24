// Peer comps rules (TRM-12): filter, sort with blanks always last, and pin up to 5 companies at the top. Pure functions.
import { groupOf, recs, UNCLASSIFIED, type MetricRow, type Upcoming } from "./metrics-core";

export type CompCo = { id: number; ticker: string; name: string; segment: string | null; size_tier: string | null; markets: string[] | null };
export type CompRow = { c: CompCo; m: MetricRow | null; next: Upcoming[]; regions: string[] };
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
