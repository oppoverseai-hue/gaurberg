// Peer comps data (TRM-12, server only): the screener's mapped companies plus stored Finnhub metrics and upcoming earnings.
// Reads company_metrics and company_events through row-level security (allowed users: promoted rows; the admin: staged too),
// companies for names, segments and markets, and the existing revenue-by-region rows (getGeo) for the region filter. No writes.
import { supabaseServer } from "@/lib/supabase/server";
import { isOffline } from "@/lib/mode";
import { readSnapshot } from "@/lib/saved";
import { getGeo } from "@/lib/data";
import { regionOf } from "@/lib/graph";
import { latestMetrics, upcomingByCompany, type EventRow, type MetricRow } from "@/lib/metrics-core";
import type { CompCo, CompRow } from "@/lib/comps-core";

export type CompsData = { rows: CompRow[]; loaded: number; staged: number; offline: boolean; error: boolean; asOf: string[] };

export async function loadComps(scope: "all" | "viewed"): Promise<CompsData> {
  const today = new Date().toISOString().slice(0, 10);
  if (isOffline()) {
    const cos = (readSnapshot()?.companies ?? []).filter((c) => c.is_seed && c.ticker) as unknown as CompCo[];
    return { rows: cos.map((c) => ({ c, m: null, next: [], regions: [] })), loaded: 0, staged: 0, offline: true, error: false, asOf: [] };
  }
  const supabase = await supabaseServer();
  let cos = ((await supabase.from("companies").select("id,ticker,name,segment,size_tier,markets").eq("is_seed", true).not("ticker", "is", null)).data ?? []) as CompCo[];
  if (scope === "viewed") {
    const v = new Set(((await supabase.from("viewed_companies").select("company_id")).data ?? []).map((x: { company_id: number }) => x.company_id));
    cos = cos.filter((c) => v.has(c.id));
  }
  const ids = cos.map((c) => c.id);
  if (!ids.length) return { rows: [], loaded: 0, staged: 0, offline: false, error: false, asOf: [] };
  const [m, e, g] = await Promise.all([
    supabase.from("company_metrics").select("company_id,as_of,data_period,pe_ttm,ev_ebitda,operating_margin,net_margin,revenue_growth_yoy,debt_to_equity,rec_period,rec_strong_buy,rec_buy,rec_hold,rec_sell,rec_strong_sell,source,fetched_at,status,note").in("company_id", ids).neq("status", "rejected"),
    supabase.from("company_events").select("company_id,event_date,event_type,detail,source,fetched_at,status").in("company_id", ids).neq("status", "rejected").gte("event_date", today),
    getGeo(ids),
  ]);
  const lm = latestMetrics((m.data ?? []) as MetricRow[]);
  const up = upcomingByCompany((e.data ?? []) as EventRow[], today);
  const rows = cos.map((c) => ({
    c, m: lm.get(c.id) ?? null, next: up.get(c.id) ?? [],
    regions: [...new Set((g.geo[c.id] ?? []).map((r) => regionOf(r, g.countryRegion)).filter((x): x is string => !!x))],
  }));
  const shown = [...lm.values()];
  return { rows, loaded: shown.length, staged: shown.filter((x) => x.status === "staged").length, offline: false, error: !!(m.error || e.error), asOf: [...new Set(shown.map((x) => x.as_of))].sort() };
}
