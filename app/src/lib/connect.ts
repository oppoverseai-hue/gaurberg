// Data for the Connection finder (GRF-16). Promoted links only, for every viewer: the admin's staged rows are left out on purpose.
// Online it reads Supabase; in offline demo mode it reads the saved snapshot (promoted links only).
import { supabaseServer } from "@/lib/supabase/server";
import { isOffline } from "@/lib/mode";
import { readSnapshot } from "@/lib/saved";
import { REL_SEL } from "@/lib/data";
import type { Co, Rel } from "@/lib/graph";

export type Pick = { co: Co | null; options: Co[] }; // options: close matches when the text did not pick one company

const CO = "id,ticker,name,is_seed,entity_type,markets";

export async function listCompanies(): Promise<Co[]> {
  if (isOffline()) return (readSnapshot()?.companies ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));
  const supabase = await supabaseServer();
  const { data } = await supabase.from("companies").select(CO).order("name").limit(2000);
  return (data ?? []) as Co[];
}

// Ticker first, then exact name, then a unique partial name match.
export function pickCompany(q: string | undefined, all: Co[]): Pick {
  const t = (q ?? "").trim();
  if (!t) return { co: null, options: [] };
  const l = t.toLowerCase();
  const exact = all.find((c) => c.ticker?.toLowerCase() === l) ?? all.find((c) => c.name.toLowerCase() === l);
  if (exact) return { co: exact, options: [] };
  const part = all.filter((c) => c.name.toLowerCase().includes(l));
  return part.length === 1 ? { co: part[0], options: [] } : { co: null, options: part.slice(0, 8) };
}

export async function promotedRelsFor(ids: number[]): Promise<{ rels: Rel[]; error: boolean }> {
  if (isOffline()) {
    const s = readSnapshot();
    return { rels: (s?.rels ?? []).filter((r) => r.status === "promoted" && (ids.includes(r.source.id) || ids.includes(r.target.id))), error: !s };
  }
  const supabase = await supabaseServer();
  const list = ids.join(",");
  const { data, error } = await supabase.from("relationships").select(REL_SEL).eq("status", "promoted").or(`source_id.in.(${list}),target_id.in.(${list})`);
  return { rels: (data ?? []) as unknown as Rel[], error: !!error };
}
