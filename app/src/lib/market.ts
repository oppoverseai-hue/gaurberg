// Market data for one company: live from Finnhub / Twelve Data, with saved files as the fallback (DEM-1, DEM-3).
// A failed live call is logged and never leaves a blank: the page shows the saved value (labelled) or a clear message.
import { getFundamentals, getHistory, getNextEarnings, getQuote, type Fundamentals, type Profile, type Quote } from "@/lib/finnhub";
import { isOffline } from "@/lib/mode";
import { readMarket, type Pt, type SavedMarket } from "@/lib/saved";

export type Market = {
  quote: Quote | null; quoteError: string | null;
  daily: Pt[] | null; weekly: Pt[] | null; historyError: string | null;
  f: Partial<Fundamentals> | null; fundError: string | null;
  profile: (Profile & { employees?: number | null; description?: string | null }) | null;
  nextEarnings: string | null;
  saved: { at: string; source: string; parts: string[] } | null; // which parts came from saved data
};

export async function getMarket(ticker: string): Promise<Market> {
  const sv: SavedMarket | null = readMarket(ticker);
  const used: string[] = [];
  const m: Market = { quote: null, quoteError: null, daily: null, weekly: null, historyError: null, f: null, fundError: null, profile: null, nextEarnings: null, saved: null };
  if (!isOffline()) {
    const [q, d, w, f, ne] = await Promise.all([getQuote(ticker), getHistory(ticker), getHistory(ticker, 1825, "1week"), getFundamentals(ticker), getNextEarnings(ticker)]);
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
    if (!m.nextEarnings && sv.nextEarnings) m.nextEarnings = sv.nextEarnings;
    if (used.length || sv.profile?.description || sv.profile?.employees) m.saved = { at: sv.saved_at, source: sv.source, parts: used };
  }
  return m;
}
