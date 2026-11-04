// The search index (TRM-1): every company's name, ticker and aliases with its link count and map context, built from two reads
// and kept for 5 minutes per role. Row-level security decides the links: allowed users count promoted links, the admin also staged ones.
// Offline it is built from the saved snapshot.
import { supabaseServer } from "@/lib/supabase/server";
import { isOffline } from "@/lib/mode";
import { readSnapshot } from "@/lib/saved";
import { buildIndex, type Entry, type IndexCo, type IndexLink } from "@/lib/search-core";

const TTL_MS = 5 * 60 * 1000;
const PAGE = 1000; // the API's row limit per request
const cache = new Map<string, { at: number; index: Entry[] }>();

async function build(): Promise<Entry[]> {
  if (isOffline()) {
    const s = readSnapshot();
    const links = (s?.rels ?? []).filter((r) => r.status !== "rejected").map((r) => ({ source_id: r.source.id, target_id: r.target.id }));
    return buildIndex((s?.companies ?? []) as IndexCo[], links);
  }
  const supabase = await supabaseServer();
  const cos = await supabase.from("companies").select("id,ticker,name,is_seed,entity_type,aliases,markets").order("id").limit(5000);
  if (cos.error) throw new Error(cos.error.message);
  const links: IndexLink[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from("relationships").select("source_id,target_id").neq("status", "rejected").order("id").range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    links.push(...((data ?? []) as IndexLink[]));
    if (!data || data.length < PAGE) break;
  }
  return buildIndex((cos.data ?? []) as IndexCo[], links);
}

/** The index for this viewer's role. A failed build is not cached, so the next request tries again. */
export async function getIndex(role: string | undefined): Promise<Entry[]> {
  const key = role === "admin" ? "admin" : "user";
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.index;
  const index = await build();
  cache.set(key, { at: Date.now(), index });
  return index;
}
