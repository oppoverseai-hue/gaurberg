// Data for "Earnings-day reaction" (GRF-20): the focal company's last report dates from reviewed SEC 8-K rows and the stored closes
// of the companies linked to it around each date. Promoted rows only, for every viewer, the admin included (staged dates are
// reviewed on the admin page first). Server only.
import fs from "node:fs";
import { supabaseServer } from "@/lib/supabase/server";
import { isOffline } from "@/lib/mode";
import { isUSListed } from "@/lib/listing";
import { isGroup, type Co, type Rel } from "@/lib/graph";
import { neighbours } from "@/lib/around-core";
import { lastReports, reactionTable, SEC_SOURCE } from "@/lib/reaction-core";

type EventRow = { event_date: string; source: string; detail: string | null };
type Close = { company_id: number; ts: string; close: number };
export type ReactionData = { table: ReturnType<typeof reactionTable<Co>> | null; why: string | null };

const shift = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

/** Why there is nothing to show: said in words, never filled in. */
export function whyNone(co: { name: string; markets?: string[] | null }): string {
  return isUSListed(co.markets)
    ? `No reviewed report dates for ${co.name} yet. They come from its SEC 8-K item 2.02 filings and appear once the admin has reviewed them. Foreign issuers that file 6-K reports have none.`
    : `Report dates come from SEC 8-K filings (item 2.02). ${co.name}'s main listing is outside the US, so none are stored.`;
}

export async function getReaction(focal: Co & { markets?: string[] | null }, rels: Rel[]): Promise<ReactionData> {
  const linked = neighbours(rels.filter((r) => r.status === "promoted"), focal.id).map((n) => n.co).filter((c) => !isGroup(c));
  let events: EventRow[], closes: Close[];
  if (isOffline()) {
    // Local screenshots only (the offline demo never runs on Vercel): a saved read-only export of promoted rows and closes.
    const f = process.env.DEV_REACTION_FIXTURE;
    const fx = f ? (JSON.parse(fs.readFileSync(f, "utf8")) as Record<string, { events: EventRow[]; closes: Close[] }>)[String(focal.id)] : undefined;
    if (!fx) return { table: null, why: "Offline: report dates and closes are not saved for the offline demo." };
    ({ events, closes } = fx);
  } else {
    const supabase = await supabaseServer();
    const { data } = await supabase.from("company_events").select("event_date,source,detail").eq("company_id", focal.id).eq("event_type", "earnings").eq("status", "promoted").like("source", "https://www.sec.gov/%").order("event_date", { ascending: false }).limit(12);
    events = (data ?? []) as EventRow[];
    const reports = lastReports(events);
    const ids = [focal.id, ...linked.map((c) => c.id)];
    const parts = await Promise.all(reports.map((r) => supabase.from("price_cache").select("company_id,ts,close").in("company_id", ids).gte("ts", shift(r.date, -8)).lte("ts", `${shift(r.date, 8)}T23:59:59Z`).order("ts")));
    closes = parts.flatMap((p) => (p.data ?? []) as Close[]);
  }
  const reports = lastReports(events.filter((e) => SEC_SOURCE.test(e.source)));
  if (!reports.length) return { table: null, why: whyNone(focal) };
  const byCo = new Map<number, Map<string, number>>();
  for (const c of closes) (byCo.get(c.company_id) ?? byCo.set(c.company_id, new Map()).get(c.company_id)!).set(c.ts.slice(0, 10), Number(c.close));
  return { table: reactionTable(reports, focal, linked, byCo), why: null };
}
