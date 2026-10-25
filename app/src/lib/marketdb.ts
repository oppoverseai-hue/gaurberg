// Stored market data (M17, DEM-1): metrics and upcoming events loaded by agents/market_data/load_fundamentals.py from Finnhub.
// Row-level security shows allowed users promoted rows only; the admin also sees staged rows. Offline there is no stored copy (a gap, not a guess).
import { supabaseServer } from "@/lib/supabase/server";
import { isOffline } from "@/lib/mode";

export type Metrics = {
  as_of: string; data_period: string | null;
  pe_ttm: number | null; ev_ebitda: number | null; gross_margin: number | null; operating_margin: number | null; net_margin: number | null;
  revenue_growth_yoy: number | null; debt_to_equity: number | null;
  rec_period: string | null; rec_strong_buy: number | null; rec_buy: number | null; rec_hold: number | null; rec_sell: number | null; rec_strong_sell: number | null;
  source: string; fetched_at: string; status: string; note: string | null;
};
export type CoEvent = { event_date: string; event_type: string; detail: string | null; source: string; fetched_at: string; status: string };

const NUM = ["pe_ttm", "ev_ebitda", "gross_margin", "operating_margin", "net_margin", "revenue_growth_yoy", "debt_to_equity"] as const;

export async function getMetrics(companyId: number): Promise<Metrics | null> {
  if (isOffline()) return null;
  const supabase = await supabaseServer();
  const { data } = await supabase.from("company_metrics").select("*").eq("company_id", companyId).neq("status", "rejected").order("as_of", { ascending: false }).limit(1).maybeSingle();
  if (!data) return null;
  const m = data as Metrics;
  for (const k of NUM) m[k] = m[k] == null ? null : Number(m[k]); // numeric columns arrive as strings
  return m;
}

export async function getUpcomingEvents(companyId: number): Promise<CoEvent[]> {
  if (isOffline()) return [];
  const supabase = await supabaseServer();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase.from("company_events").select("event_date,event_type,detail,source,fetched_at,status").eq("company_id", companyId).neq("status", "rejected").gte("event_date", today).order("event_date").limit(6);
  // A run stages every date it lists, so a promoted date can have a staged copy: show each date once, promoted first.
  const by = new Map<string, CoEvent>();
  for (const e of (data ?? []) as CoEvent[]) { const k = `${e.event_type}|${e.event_date}`; const o = by.get(k); if (!o || (o.status !== "promoted" && e.status === "promoted")) by.set(k, e); }
  return [...by.values()].slice(0, 3);
}

// Finnhub's free plan covers US listings only. The first market is taken as the primary listing, so a UK company with a US ADR
// (VOD: LSE, US) counts as UK: no stored market data, and its statements point to the annual report.
export { isUSListed } from "@/lib/listing"; // the rule lives in lib/listing.ts with the live-call gate
