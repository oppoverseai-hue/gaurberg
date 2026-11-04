// Daily insider-trade check (NFR-1, SMX-3). Vercel Cron calls this once a day (app/vercel.json, 11:30 UTC, after the market refresh).
// Reads the last 90 days of SEC Form 4 filings for each US-primary mapped company and stores the open-market buys and sells,
// so company pages read stored rows instead of EDGAR. A program, no model call (tokens and cost 0); one agent_runs row per run.
//
// Writes only insider_trades and insider_checks. Never writes companies, relationships or evidence.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { liveSymbol } from "@/lib/listing";
import { readInsiderTrades } from "@/lib/insiders";
import { DAYS } from "@/lib/insider-core";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SEC_GAP_MS = 150; // SEC asks for at most 10 requests a second
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Co = { id: number; ticker: string | null; markets: string[] | null };

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "not allowed" }, { status: 401 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });

  const started = new Date();
  let last = 0;
  const gap = async () => { const w = last + SEC_GAP_MS - Date.now(); if (w > 0) await sleep(w); last = Date.now(); };

  const RUN = { agent_name: "insider_refresh", mode: "batch", model: "none (SEC EDGAR Form 4, no model call)", tokens_in: 0, tokens_out: 0, cost_usd: 0, started_at: started.toISOString(), review_status: "auto" };
  const { data: runRow } = await db.from("agent_runs").insert({ ...RUN, status: "running", target: "started" }).select("id").single();
  const runId = (runRow as { id: number } | null)?.id ?? null;
  const deadline = started.getTime() + 250_000; // stop starting new companies 50 s before Vercel's 300 s limit, so the run is always logged
  const { data: cos, error } = await db.from("companies").select("id,ticker,markets").eq("is_seed", true).not("ticker", "is", null);
  if (error || !cos) return NextResponse.json({ error: "could not read companies" }, { status: 500 });
  const live = (cos as Co[]).filter((c) => liveSymbol(c));
  const gaps: string[] = [];
  const count = { companies: 0, filings: 0, trades: 0 };

  for (const c of live) {
    if (Date.now() > deadline) { gaps.push(`time limit: stopped before ${c.ticker}`); break; }
    const r = await readInsiderTrades(c, gap);
    const checkedAt = new Date().toISOString();
    // A company whose filing list could not be read keeps its stored trades; only the check row records the error.
    if (r.error && r.checked === 0) {
      gaps.push(`${c.ticker}: ${r.error}`);
      await db.from("insider_checks").upsert({ company_id: c.id, filings_read: 0, window_days: DAYS, checked_at: checkedAt, error: r.error }, { onConflict: "company_id" });
      continue;
    }
    const rows = r.trades.map((t) => ({ company_id: c.id, insider: t.insider, role: t.role, tx_type: t.side, shares: t.shares, price: t.price, tx_date: t.date, filed: t.filed, source_url: t.url, line: t.line, fetched_at: checkedAt }));
    if (rows.length) {
      const { error: e } = await db.from("insider_trades").upsert(rows, { onConflict: "company_id,source_url,line" });
      if (e) { gaps.push(`${c.ticker}: ${e.message}`); continue; }
    }
    // Rows not seen in this check have left the 90-day window (or were never trades); remove them.
    await db.from("insider_trades").delete().eq("company_id", c.id).lt("fetched_at", checkedAt);
    await db.from("insider_checks").upsert({ company_id: c.id, filings_read: r.checked, window_days: DAYS, checked_at: checkedAt, error: r.error ?? null }, { onConflict: "company_id" });
    if (r.error) gaps.push(`${c.ticker}: ${r.error}`);
    count.companies++; count.filings += r.checked; count.trades += rows.length;
  }

  const status = gaps.length === 0 ? "completed" : count.companies === 0 ? "failed" : "completed_with_gaps";
  const summary = `${live.length} companies: ${count.companies} checked, ${count.filings} Form 4 filings read, ${count.trades} open-market trades stored`;
  const target = `${summary}${gaps.length ? `; gaps: ${gaps.slice(0, 12).join("; ")}` : ""}`.slice(0, 2000);
  const done = { status, target, finished_at: new Date().toISOString() };
  if (runId) await db.from("agent_runs").update(done).eq("id", runId);
  else await db.from("agent_runs").insert({ ...RUN, ...done });
  return NextResponse.json({ status, summary, gaps });
}
