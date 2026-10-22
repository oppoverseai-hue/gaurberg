// Insider trades (SMX-3): open-market buys and sells reported on SEC Form 4, read straight from EDGAR by a program (no AI model). Server only.
import { cikFor } from "@/lib/news";

export type Trade = { insider: string; role: string; side: "Buy" | "Sell"; shares: number; price: number | null; date: string; filed: string; url: string };
export type InsiderResult = { trades: Trade[]; checked: number; error?: string };

const UA = "Gaurberg Research abhishek.g16@fms.edu";
const DAYS = 90, MAX_FILINGS = 15;
const tag = (x: string, t: string) => x.match(new RegExp(`<${t}>\\s*([\\s\\S]*?)\\s*</${t}>`))?.[1];
const val = (x: string, t: string) => { const b = tag(x, t); return b ? (tag(b, "value") ?? b.replace(/<[^>]+>/g, "").trim()) : undefined; };

export async function getInsiderTrades(ticker: string): Promise<InsiderResult> {
  try {
    const cik = await cikFor(ticker);
    if (!cik) return { trades: [], checked: 0 };
    const sres = await fetch(`https://data.sec.gov/submissions/CIK${cik.padStart(10, "0")}.json`, { headers: { "User-Agent": UA }, next: { revalidate: 1800 } });
    if (!sres.ok) return { trades: [], checked: 0, error: `SEC returned ${sres.status}.` };
    const r = ((await sres.json()) as { filings: { recent: Record<string, string[]> } }).filings.recent;
    const cutoff = Date.now() - DAYS * 86400_000;
    const picks: { acc: string; file: string; filed: string }[] = [];
    for (let i = 0; i < r.form.length && picks.length < MAX_FILINGS; i++) {
      if (r.form[i] !== "4" || Date.parse(r.filingDate[i]) < cutoff) continue;
      picks.push({ acc: r.accessionNumber[i].replace(/-/g, ""), file: r.primaryDocument[i].split("/").pop()!, filed: r.filingDate[i] });
    }
    const out: Trade[] = [];
    await Promise.all(picks.map(async (p) => {
      const url = `https://www.sec.gov/Archives/edgar/data/${cik}/${p.acc}/${p.file}`;
      try {
        const res = await fetch(url, { headers: { "User-Agent": UA }, next: { revalidate: 86400 } });
        if (!res.ok) return;
        const x = await res.text();
        if (parseInt(val(x, "issuerCik") ?? "0", 10) !== parseInt(cik, 10)) return; // filings where this company is the reporting owner of another issuer are not insider trades in it
        const insider = val(x, "rptOwnerName") ?? "Unknown";
        const rel = tag(x, "reportingOwnerRelationship") ?? "";
        const role = val(rel, "officerTitle") || (/<isOfficer>\s*(1|true)/i.test(rel) ? "Officer" : /<isDirector>\s*(1|true)/i.test(rel) ? "Director" : /<isTenPercentOwner>\s*(1|true)/i.test(rel) ? "10% owner" : "Insider");
        for (const m of x.matchAll(/<nonDerivativeTransaction>([\s\S]*?)<\/nonDerivativeTransaction>/g)) {
          const code = val(m[1], "transactionCode");
          if (code !== "P" && code !== "S") continue;
          const shares = Number(val(m[1], "transactionShares")), price = Number(val(m[1], "transactionPricePerShare"));
          const date = val(m[1], "transactionDate");
          if (!Number.isFinite(shares) || !date) continue;
          out.push({ insider, role, side: code === "P" ? "Buy" : "Sell", shares, price: Number.isFinite(price) && price > 0 ? price : null, date: date.slice(0, 10), filed: p.filed, url });
        }
      } catch { /* one unreadable filing is skipped; the count shown on the page says how many were read */ }
    }));
    out.sort((a, b) => b.date.localeCompare(a.date));
    return { trades: out, checked: picks.length };
  } catch {
    return { trades: [], checked: 0, error: "SEC filings are unreachable." };
  }
}
