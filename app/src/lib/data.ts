// One place for company and link data. Online it reads Supabase (row-level security decides what is visible);
// in offline demo mode it reads the saved snapshot (promoted links only).
import { supabaseServer } from "@/lib/supabase/server";
import { isOffline } from "@/lib/mode";
import { readSnapshot, type CoRow } from "@/lib/saved";
import type { CountryRegion, GeoMap, GeoRow, Rel } from "@/lib/graph";

export type { CoRow };
const CO = "id,ticker,name,is_seed,entity_type,segment,size_tier,markets,exchange,country";
export const REL_SEL = "id,relationship_type,exposure_pct,exposure_basis,exposure_qualifier,exposure_as_of,confidence,trust_status,source_type,status,as_of_date,note," +
  "source:companies!relationships_source_id_fkey(id,ticker,name,is_seed,entity_type,markets),target:companies!relationships_target_id_fkey(id,ticker,name,is_seed,entity_type,markets)," +
  "evidence(quote,document_url,section,published_at,quote_found)";

export async function getCompany(ticker: string): Promise<CoRow | null> {
  if (isOffline()) return readSnapshot()?.companies.find((c) => c.ticker === ticker) ?? null;
  const supabase = await supabaseServer();
  const { data } = await supabase.from("companies").select(CO).eq("ticker", ticker).maybeSingle();
  return (data as CoRow | null) ?? null;
}

export async function getRels(companyId: number): Promise<{ rels: Rel[]; error: boolean }> {
  if (isOffline()) {
    const s = readSnapshot();
    return { rels: (s?.rels ?? []).filter((r) => r.source.id === companyId || r.target.id === companyId), error: !s };
  }
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from("relationships").select(REL_SEL).neq("status", "rejected").or(`source_id.eq.${companyId},target_id.eq.${companyId}`);
  return { rels: (data ?? []) as unknown as Rel[], error: !!error };
}

export async function searchCompanies(q: string): Promise<{ ticker: string; name: string }[]> {
  const safe = q.replace(/[%,()]/g, "").trim();
  if (!safe) return [];
  if (isOffline()) {
    const l = safe.toLowerCase();
    return (readSnapshot()?.companies ?? []).filter((c) => c.ticker && c.is_seed && (c.ticker.toLowerCase() === l || c.name.toLowerCase().includes(l))).slice(0, 10) as { ticker: string; name: string }[];
  }
  const supabase = await supabaseServer();
  const { data } = await supabase.from("companies").select("ticker,name").or(`ticker.ilike.${safe},name.ilike.%${safe}%`).not("ticker", "is", null).limit(10);
  return (data ?? []) as { ticker: string; name: string }[];
}

// Revenue by country (M16). Row-level security shows allowed users promoted rows only; the admin also sees staged rows.
// The offline snapshot has no revenue rows yet, so offline shows none (a gap, not a guess).
export async function getGeo(companyIds: number[]): Promise<{ geo: GeoMap; countryRegion: CountryRegion }> {
  if (isOffline() || companyIds.length === 0) return { geo: {}, countryRegion: {} };
  const supabase = await supabaseServer();
  const [g, c] = await Promise.all([
    supabase.from("company_geo_revenue").select("company_id,country,label,bucket_region,revenue_pct,revenue_amount,currency,unit,period_end,pct_basis,status").in("company_id", companyIds).neq("status", "rejected").order("period_end", { ascending: false }),
    supabase.from("country_region").select("country,region"),
  ]);
  const geo: GeoMap = {};
  // keep only the latest period per company
  const latest = new Map<number, string>();
  ((g.data ?? []) as GeoRow[]).forEach((r) => { if (!latest.has(r.company_id)) latest.set(r.company_id, r.period_end); });
  ((g.data ?? []) as GeoRow[]).forEach((r) => { if (r.period_end === latest.get(r.company_id)) (geo[r.company_id] ??= []).push({ ...r, revenue_pct: r.revenue_pct == null ? null : Number(r.revenue_pct), revenue_amount: r.revenue_amount == null ? null : Number(r.revenue_amount) }); });
  const countryRegion: CountryRegion = Object.fromEntries(((c.data ?? []) as { country: string; region: string }[]).map((x) => [x.country, x.region]));
  return { geo, countryRegion };
}

// Remember that this user opened a company (feeds Screener "Viewed by me"). Best effort: skipped offline, never blocks the page.
export async function recordView(companyId: number): Promise<void> {
  if (isOffline()) return;
  try {
    const supabase = await supabaseServer();
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data: row } = await supabase.from("viewed_companies").select("id,views").eq("company_id", companyId).maybeSingle();
    if (row) await supabase.from("viewed_companies").update({ views: row.views + 1, last_viewed_at: new Date().toISOString() }).eq("id", row.id);
    else await supabase.from("viewed_companies").insert({ company_id: companyId });
  } catch { /* ignore */ }
}
