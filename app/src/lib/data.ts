// One place for company and link data. Online it reads Supabase (row-level security decides what is visible);
// in offline demo mode it reads the saved snapshot (promoted links only).
import { supabaseServer } from "@/lib/supabase/server";
import { isOffline } from "@/lib/mode";
import { readSnapshot, type CoRow } from "@/lib/saved";
import type { Rel } from "@/lib/graph";

export type { CoRow };
const CO = "id,ticker,name,is_seed,entity_type,segment,size_tier";
export const REL_SEL = "id,relationship_type,exposure_pct,exposure_basis,exposure_qualifier,exposure_as_of,confidence,trust_status,source_type,status,as_of_date,note," +
  "source:companies!relationships_source_id_fkey(id,ticker,name,is_seed,entity_type),target:companies!relationships_target_id_fkey(id,ticker,name,is_seed,entity_type)," +
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
  const { data, error } = await supabase.from("relationships").select(REL_SEL).or(`source_id.eq.${companyId},target_id.eq.${companyId}`);
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
