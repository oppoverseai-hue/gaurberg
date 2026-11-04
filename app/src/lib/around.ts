// Data for "Around this company" (GRF-18): report dates and last closes of the companies linked to the focal one.
// Reads company_events (promoted rows for allowed users) and price_cache, both written by the daily refresh.
import { supabaseServer } from "@/lib/supabase/server";
import { isOffline } from "@/lib/mode";
import { isGroup, type Rel } from "@/lib/graph";
import { AHEAD_DAYS, BEHIND_DAYS, moves, neighbours, reports, type Move, type Report } from "@/lib/around-core";

const nyToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const shift = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

export async function getAround(rels: Rel[], focalId: number): Promise<{ reports: Report[]; moves: Move[]; linked: number; withPrices: number }> {
  // Groups (drivers, riders) have no prices or report dates and are not companies, so they are left out (GRF-1).
  const ns = neighbours(rels.filter((r) => r.status === "promoted"), focalId).filter((n) => !isGroup(n.co));
  const ids = ns.map((n) => n.co.id);
  if (isOffline() || !ids.length) return { reports: [], moves: [], linked: ns.length, withPrices: 0 };
  const supabase = await supabaseServer();
  const today = nyToday();
  const [ev, px] = await Promise.all([
    supabase.from("company_events").select("company_id,event_date,detail,status").in("company_id", ids).eq("event_type", "earnings").eq("status", "promoted")
      .gte("event_date", shift(today, -BEHIND_DAYS)).lte("event_date", shift(today, AHEAD_DAYS)).order("event_date"),
    supabase.from("price_cache").select("company_id,ts,close").in("company_id", ids).gte("ts", new Date(Date.now() - 8 * 864e5).toISOString()).order("ts"),
  ]);
  const closes = (px.data ?? []) as { company_id: number; ts: string; close: number }[];
  return {
    reports: reports(ns, (ev.data ?? []) as { company_id: number; event_date: string; detail: string | null }[], today),
    moves: moves(ns, closes),
    linked: ns.length,
    withPrices: new Set(closes.map((c) => c.company_id)).size,
  };
}
