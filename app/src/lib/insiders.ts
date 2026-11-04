// Insider trades (SMX-3, NFR-1). Server only.
// The daily job (/api/cron/insiders) reads Form 4 filings from EDGAR with readInsiderTrades and stores them; company pages read the
// stored rows with getStoredInsiderTrades, so a page load never waits on EDGAR. Parsing rules are in insider-core.ts.
import { cikFor } from "@/lib/news";
import { liveSymbol, type Listing } from "@/lib/listing";
import { supabaseServer } from "@/lib/supabase/server";
import { DAYS, filingUrl, parseForm4, pickFilings, type Recent, type Trade } from "@/lib/insider-core";

export type { Trade } from "@/lib/insider-core";
export type InsiderResult = { trades: Trade[]; checked: number; checkedAt?: string; error?: string };

const UA = "Gaurberg Research abhishek.g16@fms.edu";
export const NOT_US = "SEC Form 4 insider trades cover US-primary listings only.";

/** Reads the last 90 days of Form 4 filings for one company from EDGAR. `gap` spaces the requests (SEC allows 10 a second). */
export async function readInsiderTrades(co: Listing, gap: () => Promise<void> = async () => {}): Promise<InsiderResult> {
  const sym = liveSymbol(co);
  if (!sym) return { trades: [], checked: 0, error: NOT_US };
  try {
    const cik = await cikFor(sym);
    if (!cik) return { trades: [], checked: 0, error: "No SEC filer number found for this ticker." };
    await gap();
    const sres = await fetch(`https://data.sec.gov/submissions/CIK${cik.padStart(10, "0")}.json`, { headers: { "User-Agent": UA }, cache: "no-store" });
    if (!sres.ok) return { trades: [], checked: 0, error: `SEC returned ${sres.status}.` };
    const picks = pickFilings(((await sres.json()) as { filings: { recent: Recent } }).filings.recent, Date.now());
    const out: Trade[] = [];
    let read = 0;
    for (const p of picks) {
      const url = filingUrl(cik, p);
      await gap();
      try {
        const res = await fetch(url, { headers: { "User-Agent": UA }, cache: "no-store" });
        if (!res.ok) continue;
        out.push(...parseForm4(await res.text(), cik, p.filed, url));
        read++;
      } catch { /* one unreadable filing is skipped; the stored count says how many were read */ }
    }
    out.sort((a, b) => b.date.localeCompare(a.date) || a.url.localeCompare(b.url) || a.line - b.line);
    return { trades: out, checked: read, error: read < picks.length ? `${picks.length - read} of ${picks.length} filings could not be read.` : undefined };
  } catch {
    return { trades: [], checked: 0, error: "SEC filings are unreachable." };
  }
}

type Row = { insider: string; role: string; tx_type: "Buy" | "Sell"; shares: number; price: number | null; tx_date: string; filed: string | null; source_url: string; line: number };

/** The stored trades and the last check for one company. A company never checked says so; nothing is read live. */
export async function getStoredInsiderTrades(co: Listing & { id: number }): Promise<InsiderResult> {
  if (!liveSymbol(co)) return { trades: [], checked: 0, error: NOT_US };
  const supabase = await supabaseServer();
  const since = new Date(Date.now() - DAYS * 864e5).toISOString().slice(0, 10);
  const [t, c] = await Promise.all([
    supabase.from("insider_trades").select("insider,role,tx_type,shares,price,tx_date,filed,source_url,line").eq("company_id", co.id).gte("tx_date", since).order("tx_date", { ascending: false }),
    supabase.from("insider_checks").select("filings_read,checked_at,error").eq("company_id", co.id).maybeSingle(),
  ]);
  if (t.error || c.error) return { trades: [], checked: 0, error: "Stored insider trades could not be read." };
  if (!c.data) return { trades: [], checked: 0, error: "Not loaded yet: the daily insider-trade check has not run for this company." };
  const check = c.data as { filings_read: number; checked_at: string; error: string | null };
  const trades = ((t.data ?? []) as Row[]).map((r) => ({ insider: r.insider, role: r.role, side: r.tx_type, shares: Number(r.shares), price: r.price == null ? null : Number(r.price), date: r.tx_date, filed: r.filed ?? "", url: r.source_url, line: r.line }));
  return { trades, checked: check.filings_read, checkedAt: check.checked_at, error: check.error ?? undefined };
}
