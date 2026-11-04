// Data for co-movement (GRF-19): daily closes from price_cache, written by the daily refresh (api/cron/refresh).
// One query per company, so no company is cut off by the API's row limit (about 260 rows each for a year).
// The offline demo uses the daily closes in the saved files (data/market/*.json) instead.
import { supabaseServer } from "@/lib/supabase/server";
import { isOffline } from "@/lib/mode";
import { readMarket } from "@/lib/saved";
import { isMapped, type Rel } from "@/lib/graph";
import { comoveAll, type Close, type Comove } from "@/lib/comove-core";

const LOOKBACK_DAYS = 400; // enough calendar days for 250 trading days

/** Co-movement of each mapped company linked to the focal one. With no mapped neighbour it is empty. */
export async function getComove(focalId: number, rels: Rel[]): Promise<Record<number, Comove>> {
  const ids = [...new Set(rels.flatMap((r) => [r.source, r.target]).filter((c) => c.id !== focalId && isMapped(c)).map((c) => c.id))];
  if (!ids.length) return {};
  if (isOffline()) {
    const saved = (c: { id: number; ticker: string | null }) => (readMarket(c.ticker ?? "")?.daily ?? []).map((p) => ({ ts: new Date(p.t * 1000).toISOString(), close: p.c }));
    const cos = new Map(rels.flatMap((r) => [r.source, r.target]).map((c) => [c.id, c]));
    return comoveAll(focalId, ids, Object.fromEntries([...cos.values()].map((c) => [c.id, saved(c)])));
  }
  const supabase = await supabaseServer();
  const since = new Date(Date.now() - LOOKBACK_DAYS * 864e5).toISOString();
  const res = await Promise.all([focalId, ...ids].map((id) => supabase.from("price_cache").select("ts,close").eq("company_id", id).gte("ts", since).order("ts")));
  const closes: Record<number, Close[]> = {};
  [focalId, ...ids].forEach((id, i) => { closes[id] = ((res[i].data ?? []) as Close[]).map((c) => ({ ts: c.ts, close: Number(c.close) })); });
  const out = comoveAll(focalId, ids, closes);
  const failed = (i: number) => !!res[i].error;
  ids.forEach((id, i) => { if (failed(0) || failed(i + 1)) out[id] = { ok: false, days: 0, gap: "Prices could not be loaded right now" }; });
  return out;
}
