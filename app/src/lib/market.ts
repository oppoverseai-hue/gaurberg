// Market data for one company: live from Finnhub / Twelve Data, with saved files as the fallback (DEM-1, DEM-3).
// A failed live call is logged and never leaves a blank: the page shows the saved value (labelled) or a clear message.
import { getFundamentals, getHistory, getNextEarnings, getQuote, type Fundamentals, type Profile, type Quote } from "@/lib/finnhub";
import { isOffline } from "@/lib/mode";
import { readMarket, type Pt, type SavedMarket } from "@/lib/saved";
import { liveSymbol, NOT_LIVE_DATA, NOT_LIVE_PRICE, type Listing } from "@/lib/listing";

export type Market = {
  quote: Quote | null; quoteError: string | null;
  daily: Pt[] | null; weekly: Pt[] | null; historyError: string | null;
  f: Partial<Fundamentals> | null; fundError: string | null;
  profile: (Profile & { employees?: number | null; description?: string | null; about_source?: string | null }) | null;
  nextEarnings: string | null;
  filingNote: string | null; // set when a highlight comes from the 10-K, not the data service
  saved: { at: string; source: string; parts: string[] } | null; // which parts came from saved data
};

// Takes the company, not a bare ticker: live calls go only through liveSymbol (US-primary listings). A non-US-primary company
// gets its saved file if there is one (labelled with its date by the page), otherwise "Live price not available for this listing".
export async function getMarket(co: Listing): Promise<Market> {
  const ticker = co.ticker ?? "";
  const sym = liveSymbol(co);
  const sv: SavedMarket | null = ticker ? readMarket(ticker) : null;
  const used: string[] = [];
  const m: Market = { quote: null, quoteError: null, daily: null, weekly: null, historyError: null, f: null, fundError: null, profile: null, nextEarnings: null, filingNote: null, saved: null };
  if (!sym) {
    m.quoteError = NOT_LIVE_PRICE; m.historyError = NOT_LIVE_PRICE; m.fundError = NOT_LIVE_DATA;
  } else if (!isOffline()) {
    const [q, d, w, f, ne] = await Promise.all([getQuote(sym), getHistory(sym), getHistory(sym, 1825, "1week"), getFundamentals(sym), getNextEarnings(sym)]);
    if (q.ok) m.quote = q.quote; else { m.quoteError = q.reason; console.error("[market] quote", ticker, q.reason); }
    if (d.ok) m.daily = d.points; else { m.historyError = d.reason; console.error("[market] history", ticker, d.reason); }
    if (w.ok) m.weekly = w.points;
    if (f.ok) { m.f = f.f; m.profile = f.profile; } else { m.fundError = f.reason; console.error("[market] fundamentals", ticker, f.reason); }
    m.nextEarnings = ne;
  } else {
    m.quoteError = m.historyError = m.fundError = "Offline: no live data.";
  }
  if (sv) {
    if (!m.quote && sv.quote) { m.quote = sv.quote; used.push("price"); }
    if (!m.daily && sv.daily) { m.daily = sv.daily; used.push("price history"); }
    if (!m.weekly && sv.weekly) m.weekly = sv.weekly;
    if (!m.f && sv.fundamentals) { m.f = sv.fundamentals; used.push("fundamentals"); }
    if (sv.profile) {
      // About text and employees are not on Finnhub's free plan; they come from saved or admin-provided data.
      m.profile = { exchange: null, industry: null, website: null, ...(m.profile ?? {}), ...Object.fromEntries(Object.entries(sv.profile).filter(([k, v]) => v != null && (m.profile as Record<string, unknown> | null)?.[k] == null)) };
    }
    if (sv.filing) { // fill only the gaps, label the source
      const g = { ...(m.f ?? {}) } as Record<string, number | null | undefined>; let filled = false;
      for (const k of ["revGrowth", "opMargin", "netMargin"] as const) if (g[k] == null && sv.filing[k] != null) { g[k] = sv.filing[k]; filled = true; }
      if (filled) { m.f = g as Partial<Fundamentals>; m.filingNote = `Revenue growth and margins shown where the data service has none: ${sv.filing.period} annual figures from the 10-K filed ${sv.filing.filed}.`; }
    }
    if (!m.nextEarnings && sv.nextEarnings) m.nextEarnings = sv.nextEarnings;
    if (used.length) m.saved = { at: sv.saved_at, source: sv.source, parts: used };
  }
  return m;
}
