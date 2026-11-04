// Numbers and quotes on the public landing page (ACC-7). Counts are read from the database (service role, cached for an
// hour) so the page never shows a stale or made-up figure; if the read fails, the numbers are left out, not guessed.
// Quotes are word for word from the promoted evidence rows they name.
import { unstable_cache } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type Stats = { links: number; companies: number; mapped: number; uberLinks: number; uberByType: Record<string, number> } | null;

export const getStats = unstable_cache(async (): Promise<Stats> => {
  const db = supabaseAdmin();
  if (!db) return null;
  const [l, c, m, u] = await Promise.all([
    db.from("relationships").select("id", { count: "exact", head: true }).eq("status", "promoted"),
    db.from("companies").select("id", { count: "exact", head: true }),
    db.from("companies").select("id", { count: "exact", head: true }).eq("is_seed", true),
    db.from("companies").select("id").eq("ticker", "UBER").maybeSingle(),
  ]);
  if (l.error || c.error || m.error || !u.data) return null;
  const { data: rels } = await db.from("relationships").select("relationship_type").eq("status", "promoted").or(`source_id.eq.${u.data.id},target_id.eq.${u.data.id}`);
  const uberByType: Record<string, number> = {};
  for (const r of (rels ?? []) as { relationship_type: string }[]) uberByType[r.relationship_type] = (uberByType[r.relationship_type] ?? 0) + 1;
  return { links: l.count ?? 0, companies: c.count ?? 0, mapped: m.count ?? 0, uberLinks: rels?.length ?? 0, uberByType };
}, ["landing-stats-v1"], { revalidate: 3600 });

// Word-for-word quotes from promoted evidence (checked Nov 4, 2026).
export const QUOTES = {
  minority: {
    text: "a significant portion of our assets includes minority ownership positions, including in Didi, Grab, and Aurora.",
    cite: "Uber 10-K · risk factors · filed 2026-02-13",
  },
  lyft: {
    text: "We also compete with other ridesharing companies for Drivers and Riders, including Bolt, Didi, Lyft, and Ola.",
    cite: "Uber 10-K · business · filed 2026-02-13",
  },
  apollo: {
    text: "In July 2025, Apollo Go entered into a multi-year strategic partnership with Uber Technologies, Inc. to deploy thousands of Apollo Go’s fully autonomous vehicles on the Uber platform",
    cite: "Baidu 20-F · filed 2026-03-17",
  },
};
