// Events calendar data (TRM-13, server only). Reads companies, company_events and which companies have a visible
// company_metrics row, all through row-level security (allowed users: promoted rows; the admin: staged too). No writes.
import { supabaseServer } from "@/lib/supabase/server";
import { isOffline } from "@/lib/mode";
import { readSnapshot } from "@/lib/saved";
import type { EventRow } from "@/lib/metrics-core";
import type { CalCo } from "@/lib/calendar-core";

export type CalData = { cos: CalCo[]; events: EventRow[]; loadedIds: Set<number>; offline: boolean; error: boolean };

export async function loadCalendar(today: string, until: string): Promise<CalData> {
  if (isOffline()) {
    const cos = (readSnapshot()?.companies ?? []).filter((c) => c.is_seed && c.ticker) as unknown as CalCo[];
    return { cos, events: [], loadedIds: new Set(), offline: true, error: false };
  }
  const supabase = await supabaseServer();
  const cos = ((await supabase.from("companies").select("id,ticker,name,markets").eq("is_seed", true).not("ticker", "is", null)).data ?? []) as CalCo[];
  const ids = cos.map((c) => c.id);
  if (!ids.length) return { cos, events: [], loadedIds: new Set(), offline: false, error: false };
  const [e, m] = await Promise.all([
    supabase.from("company_events").select("company_id,event_date,event_type,detail,source,fetched_at,status").in("company_id", ids).neq("status", "rejected").gte("event_date", today).lte("event_date", until),
    supabase.from("company_metrics").select("company_id").in("company_id", ids).neq("status", "rejected"),
  ]);
  return {
    cos, events: (e.data ?? []) as EventRow[],
    loadedIds: new Set(((m.data ?? []) as { company_id: number }[]).map((x) => x.company_id)),
    offline: false, error: !!(e.error || m.error),
  };
}
