// Daily market-data refresh in the cloud (DEM-1, DEM-3, TRM-13). Vercel Cron calls this once a day (app/vercel.json,
// 11:00 UTC = 19:00 Makassar; Hobby plan runs it within that hour). Replaces the Mac launchd job for everything the
// hosted app shows. No model call (tokens and cost 0); one agent_runs row per run.
//
// Writes, for US-primary mapped companies only (liveSymbol):
//   price_cache       the last close from Finnhub /quote, plus missing daily closes from Twelve Data for up to GAP_FILL companies a run
//   company_metrics   today's ratios and analyst counts, promoted (a rejected row for the day is left alone)
//   company_events    earnings dates by the rules in lib/refresh-core.ts (rejected dates never return; a changed date is staged)
// Never writes companies, relationships or evidence.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { liveSymbol } from "@/lib/listing";
import { readMarket } from "@/lib/saved";
import { metricsRow, parseCalendar, planEvents, type StoredEvent } from "@/lib/refresh-core";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const FH = "https://finnhub.io/api/v1";
const FH_GAP_MS = 1100; // free plan: 60 calls a minute
const TD_GAP_MS = 8000; // Twelve Data free plan: 8 credits a minute
const GAP_FILL = 5; // companies per run whose price history is topped up from Twelve Data
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const day = (d: Date) => d.toISOString().slice(0, 10);
// One row per trading day: every close is stored at 00:00 UTC of its New York trading date, whatever the source's timestamp.
const nyDate = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
const barTs = (date: string) => `${date}T00:00:00.000Z`;

type Co = { id: number; ticker: string | null; markets: string[] | null };

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "not allowed" }, { status: 401 });
  const db = supabaseAdmin();
  const fkey = process.env.FINNHUB_API_KEY, tkey = process.env.TWELVEDATA_API_KEY;
  if (!db || !fkey) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY or FINNHUB_API_KEY is not set" }, { status: 500 });

  const started = new Date();
  let last = 0;
  const fh = async (path: string, params: Record<string, string>) => {
    const wait = last + FH_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    for (let attempt = 0; attempt < 3; attempt++) {
      last = Date.now();
      try {
        const r = await fetch(`${FH}${path}?${new URLSearchParams({ ...params, token: fkey })}`, { cache: "no-store" });
        if (r.status === 429) { await sleep(5000 * (attempt + 1)); continue; }
        if (!r.ok) return { ok: false as const, why: `${path} HTTP ${r.status}` };
        return { ok: true as const, json: await r.json() };
      } catch { await sleep(3000 * (attempt + 1)); } // network blip: retry, the Mac job failed here every night
    }
    return { ok: false as const, why: `${path} unreachable after 3 tries` };
  };

  const RUN = { agent_name: "market_refresh", mode: "batch", model: "none (Finnhub and Twelve Data APIs, no model call)", tokens_in: 0, tokens_out: 0, cost_usd: 0, started_at: started.toISOString(), review_status: "auto" };
  const { data: runRow } = await db.from("agent_runs").insert({ ...RUN, status: "running", target: "started" }).select("id").single();
  const runId = (runRow as { id: number } | null)?.id ?? null;
  const deadline = started.getTime() + 250_000; // stop starting new work 50 s before Vercel's 300 s limit, so the run is always logged
  const { data: cos, error } = await db.from("companies").select("id,ticker,markets").eq("is_seed", true).not("ticker", "is", null);
  if (error || !cos) return NextResponse.json({ error: "could not read companies" }, { status: 500 });
  const live = (cos as Co[]).filter((c) => liveSymbol(c));
  const today = day(started), from = day(new Date(started.getTime() - 21 * 864e5)), to = day(new Date(started.getTime() + 90 * 864e5));
  const log: string[] = [], gaps: string[] = [];
  const count = { closes: 0, metrics: 0, events: 0, staged: 0, skipped: 0, filled: 0 };

  let cut = false;
  for (const c of live) {
    if (Date.now() > deadline) { cut = true; gaps.push(`time limit: stopped before ${c.ticker}`); break; }
    const sym = liveSymbol(c)!;
    // 1. Last close.
    const q = await fh("/quote", { symbol: sym });
    if (q.ok && typeof q.json?.c === "number" && q.json.c > 0 && q.json.t > 0) {
      const { error: e } = await db.from("price_cache").upsert({ company_id: c.id, ts: barTs(nyDate(q.json.t * 1000)), close: q.json.c }, { onConflict: "company_id,ts" });
      if (e) gaps.push(`${sym} close: ${e.message}`); else count.closes++;
    } else gaps.push(`${sym} quote: ${q.ok ? "empty" : q.why}`);

    // 2. Ratios and analyst counts (promoted; never overwrites a row the admin rejected).
    const [m, r] = [await fh("/stock/metric", { symbol: sym, metric: "all" }), await fh("/stock/recommendation", { symbol: sym })];
    const row = m.ok ? metricsRow(m.json, r.ok ? r.json : null) : null;
    if (row) {
      const { data: ex } = await db.from("company_metrics").select("id,status").eq("company_id", c.id).eq("as_of", today).eq("source", "finnhub").maybeSingle();
      if (ex?.status === "rejected") count.skipped++;
      else {
        const { error: e } = await db.from("company_metrics").upsert({ company_id: c.id, as_of: today, source: "finnhub", ...row, fetched_at: new Date().toISOString(), status: "promoted", note: r.ok ? null : "recommendation trends not returned" }, { onConflict: "company_id,as_of,source" });
        if (e) gaps.push(`${sym} metrics: ${e.message}`); else count.metrics++;
      }
    } else gaps.push(`${sym} metrics: ${m.ok ? "empty" : m.why}`);

    // 3. Earnings dates, from three weeks back (to catch reports that already happened) to 90 days ahead.
    const cal = await fh("/calendar/earnings", { symbol: sym, from, to });
    if (cal.ok) {
      const { data: stored } = await db.from("company_events").select("id,event_date,detail,status").eq("company_id", c.id).eq("event_type", "earnings").eq("source", "finnhub").gte("event_date", from);
      const now = new Date().toISOString();
      for (const a of planEvents((stored ?? []) as StoredEvent[], parseCalendar(cal.json?.earningsCalendar))) {
        let e: { message: string } | null = null;
        if (a.kind === "skip") { count.skipped++; continue; }
        if (a.kind === "touch") ({ error: e } = await db.from("company_events").update({ detail: a.detail, fetched_at: now }).eq("id", a.id));
        if (a.kind === "insert") {
          ({ error: e } = await db.from("company_events").insert({ company_id: c.id, event_date: a.date, event_type: "earnings", detail: a.detail, source: "finnhub", fetched_at: now, status: a.status }));
          if (a.status === "staged") { count.staged++; log.push(`${sym} ${a.date} staged: ${a.reason}`); }
        }
        if (e) gaps.push(`${sym} event ${a.date}: ${e.message}`); else if (a.kind !== "touch") count.events++;
      }
    } else gaps.push(`${sym} calendar: ${cal.why}`);
  }

  // 4. Top up daily closes. First the saved files bundled with the app (up to Oct 21), then Twelve Data for the gap since.
  if (tkey && !cut) {
    let filled = 0, tried = 0;
    for (const c of live) {
      if (Date.now() > deadline) { gaps.push(`time limit: price history top-up stopped before ${c.ticker}`); break; }
      const { count: total } = await db.from("price_cache").select("ts", { count: "exact", head: true }).eq("company_id", c.id);
      if ((total ?? 0) < 100) { // empty or new: seed from the saved file first (no network call)
        const bars = readMarket(c.ticker!)?.daily ?? [];
        if (bars.length) await db.from("price_cache").upsert(bars.map((b) => ({ company_id: c.id, ts: barTs(nyDate(b.t * 1000)), close: b.c })), { onConflict: "company_id,ts", ignoreDuplicates: true });
      }
      const { count: recent } = await db.from("price_cache").select("ts", { count: "exact", head: true }).eq("company_id", c.id).gte("ts", new Date(started.getTime() - 20 * 864e5).toISOString());
      if ((recent ?? 0) >= 12 || tried >= GAP_FILL) continue; // about three weeks of trading days already there, or this run's quota used
      tried++; // count attempts, not successes: a failing history service must not stall the run
      await sleep(TD_GAP_MS);
      try {
        const r = await fetch(`https://api.twelvedata.com/time_series?${new URLSearchParams({ symbol: liveSymbol(c)!, interval: "1day", outputsize: "30", order: "ASC", apikey: tkey })}`, { cache: "no-store" });
        const j = await r.json();
        if (j.status !== "ok" || !Array.isArray(j.values)) { gaps.push(`${c.ticker} history: ${j.message ?? r.status}`); continue; }
        const rows = (j.values as { datetime: string; close: string }[]).map((v) => ({ company_id: c.id, ts: barTs(v.datetime.slice(0, 10)), close: Number(v.close) })).filter((x) => Number.isFinite(x.close));
        const { error: e } = await db.from("price_cache").upsert(rows, { onConflict: "company_id,ts", ignoreDuplicates: true });
        if (e) gaps.push(`${c.ticker} history: ${e.message}`); else { filled++; count.filled++; }
      } catch { gaps.push(`${c.ticker} history: unreachable`); }
    }
  }

  const status = gaps.length === 0 ? "completed" : count.closes + count.metrics === 0 ? "failed" : "completed_with_gaps";
  const summary = `${live.length} companies: ${count.closes} closes, ${count.metrics} metrics rows, ${count.events} date changes (${count.staged} staged), ${count.filled} histories topped up, ${count.skipped} skipped`;
  const target = `${summary}${gaps.length ? `; gaps: ${gaps.slice(0, 12).join("; ")}` : ""}${log.length ? `; ${log.slice(0, 12).join("; ")}` : ""}`.slice(0, 2000);
  const done = { status, target, finished_at: new Date().toISOString() };
  if (runId) await db.from("agent_runs").update(done).eq("id", runId);
  else await db.from("agent_runs").insert({ ...RUN, ...done });
  return NextResponse.json({ status, summary, gaps, log });
}
