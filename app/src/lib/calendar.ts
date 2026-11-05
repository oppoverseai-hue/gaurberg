// Earnings calendar data (TRM-13, GRF-20, server only). Reads only; no writes.
// Through row-level security: seed companies, promoted Finnhub earnings rows from today on, promoted link counts, which companies have
// a promoted SEC 8-K report date, and which have a visible company_metrics row. Staged Finnhub rows from today on ("date changes under
// review") are invisible to reviewers under RLS, so they are read with the service-role client, company id and date only.
import fs from "node:fs";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isOffline } from "@/lib/mode";
import { readSnapshot } from "@/lib/saved";
import type { CalCo, CalEvent } from "@/lib/calendar-core";

export type CalData = { cos: CalCo[]; events: CalEvent[]; links: Record<number, number>; secIds: number[]; loadedIds: number[]; offline: boolean; error: boolean };

const PAGE = 1000; // the API's row limit per request

export async function loadCalendar(today: string): Promise<CalData> {
  if (isOffline()) {
    // Local screenshots only (the offline demo never runs on Vercel): a saved read-only export, as in tests/fixtures.
    const f = process.env.DEV_CALENDAR_FIXTURE;
    if (f) {
      const fx = JSON.parse(fs.readFileSync(f, "utf8")) as Omit<CalData, "offline" | "error">;
      return { ...fx, offline: false, error: false };
    }
    const cos = (readSnapshot()?.companies ?? []).filter((c) => c.is_seed) as unknown as CalCo[];
    return { cos, events: [], links: {}, secIds: [], loadedIds: [], offline: true, error: false };
  }
  const supabase = await supabaseServer();
  const c = await supabase.from("companies").select("id,ticker,name,markets,segment").eq("is_seed", true);
  const cos = (c.data ?? []) as CalCo[];
  const ids = cos.map((x) => x.id);
  if (!ids.length) return { cos, events: [], links: {}, secIds: [], loadedIds: [], offline: false, error: !!c.error };
  const admin = supabaseAdmin() ?? supabase;
  const [e, s, sec, m] = await Promise.all([
    supabase.from("company_events").select("company_id,event_date,detail,status,fetched_at").in("company_id", ids).eq("event_type", "earnings").eq("source", "finnhub").eq("status", "promoted").gte("event_date", today),
    admin.from("company_events").select("company_id,event_date").in("company_id", ids).eq("event_type", "earnings").eq("source", "finnhub").eq("status", "staged").gte("event_date", today),
    supabase.from("company_events").select("company_id").in("company_id", ids).eq("event_type", "earnings").eq("status", "promoted").like("source", "https://www.sec.gov/%"),
    supabase.from("company_metrics").select("company_id").in("company_id", ids).neq("status", "rejected"),
  ]);
  const links: Record<number, number> = {};
  const seed = new Set(ids);
  let linkError = false;
  for (let from = 0; ; from += PAGE) {
    const r = await supabase.from("relationships").select("source_id,target_id").eq("status", "promoted").or(`source_id.in.(${ids.join(",")}),target_id.in.(${ids.join(",")})`).order("id").range(from, from + PAGE - 1);
    if (r.error) { linkError = true; break; }
    for (const x of (r.data ?? []) as { source_id: number; target_id: number }[]) {
      if (seed.has(x.source_id)) links[x.source_id] = (links[x.source_id] ?? 0) + 1;
      if (seed.has(x.target_id)) links[x.target_id] = (links[x.target_id] ?? 0) + 1;
    }
    if (!r.data || r.data.length < PAGE) break;
  }
  const staged = ((s.data ?? []) as { company_id: number; event_date: string }[]).map((x) => ({ ...x, detail: null, status: "staged", fetched_at: "" }));
  return {
    cos,
    events: [...((e.data ?? []) as CalEvent[]), ...staged],
    links,
    secIds: [...new Set(((sec.data ?? []) as { company_id: number }[]).map((x) => x.company_id))],
    loadedIds: [...new Set(((m.data ?? []) as { company_id: number }[]).map((x) => x.company_id))],
    offline: false, error: !!(c.error || e.error || s.error || sec.error || m.error || linkError),
  };
}
