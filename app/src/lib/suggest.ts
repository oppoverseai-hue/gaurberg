// Search suggestions for the landing page. Seed companies only (the ones with a full map). Link counts follow row-level security:
// allowed users count promoted links, the admin also counts staged ones. Offline reads the saved snapshot.
import { supabaseServer } from "@/lib/supabase/server";
import { isOffline } from "@/lib/mode";
import { readSnapshot } from "@/lib/saved";

export type Suggestion = { ticker: string; name: string; markets: string[]; links: number };
type C = { id: number; ticker: string | null; name: string; markets: string[] | null };

const rank = (c: C, l: string) => {
  const t = (c.ticker ?? "").toLowerCase(), n = c.name.toLowerCase();
  return t === l ? 0 : t.startsWith(l) ? 1 : n.startsWith(l) ? 2 : n.split(/\s+/).some((w) => w.startsWith(l)) ? 3 : 4;
};

export async function suggest(q: string, limit = 6): Promise<Suggestion[]> {
  const safe = q.replace(/[%,()_*\\]/g, "").trim().slice(0, 40);
  let cos: C[]; let pairs: { source_id: number; target_id: number }[];
  if (isOffline()) {
    const s = readSnapshot();
    const l = safe.toLowerCase();
    cos = (s?.companies ?? []).filter((c) => c.ticker && c.is_seed && (!l || c.ticker.toLowerCase().startsWith(l) || c.name.toLowerCase().includes(l))) as C[];
    pairs = (s?.rels ?? []).map((r) => ({ source_id: r.source.id, target_id: r.target.id }));
  } else {
    const supabase = await supabaseServer();
    let qb = supabase.from("companies").select("id,ticker,name,markets").eq("is_seed", true).not("ticker", "is", null);
    if (safe) qb = qb.or(`ticker.ilike.${safe}%,name.ilike.%${safe}%`);
    const { data } = await qb.limit(60);
    cos = (data ?? []) as C[];
    const ids = cos.map((c) => c.id);
    if (!ids.length) return [];
    const { data: rs } = await supabase.from("relationships").select("source_id,target_id").neq("status", "rejected").or(`source_id.in.(${ids.join(",")}),target_id.in.(${ids.join(",")})`).limit(5000);
    pairs = (rs ?? []) as { source_id: number; target_id: number }[];
  }
  const count = new Map<number, number>();
  pairs.forEach((p) => { count.set(p.source_id, (count.get(p.source_id) ?? 0) + 1); count.set(p.target_id, (count.get(p.target_id) ?? 0) + 1); });
  const l = safe.toLowerCase();
  const out = cos.map((c) => ({ c, links: count.get(c.id) ?? 0 }));
  // typed: best text match first, then most links. Empty: the best-connected companies.
  out.sort((a, b) => (l ? rank(a.c, l) - rank(b.c, l) : 0) || b.links - a.links || a.c.name.localeCompare(b.c.name));
  return out.slice(0, limit).map(({ c, links }) => ({ ticker: c.ticker as string, name: c.name, markets: c.markets ?? [], links }));
}
