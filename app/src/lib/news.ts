// Recent news for one company (TRM-7): news and press releases from Finnhub (free plan), SEC filings from EDGAR. Server only.
export type NewsItem = { kind: "news" | "press" | "filing"; headline: string; source: string; ts: number; url: string };
export type NewsResult = { items: NewsItem[]; errors: string[] };

const UA = "Gaurberg Research abhishek.g16@fms.edu";
const WIRE = /business wire|pr newswire|prnewswire|globenewswire|accesswire|newsfile/i;
const DAYS = 30;
// Company filings that matter to a reader; insider forms (3, 4, 5) and ownership schedules are left out.
const FORMS: Record<string, string> = { "8-K": "Current report", "10-K": "Annual report", "10-Q": "Quarterly report", "6-K": "Foreign issuer report", "20-F": "Annual report (foreign issuer)", "40-F": "Annual report (foreign issuer)", "S-1": "Registration statement", "DEF 14A": "Proxy statement" };
const ITEMS: Record<string, string> = { "1.01": "material agreement", "1.02": "agreement ended", "2.01": "acquisition or disposal", "2.02": "results of operations", "2.03": "new financial obligation", "5.02": "officer or director change", "5.07": "shareholder vote", "7.01": "Regulation FD disclosure", "8.01": "other events" };

async function finnhubNews(symbol: string): Promise<{ items: NewsItem[]; error?: string }> {
  const token = process.env.FINNHUB_API_KEY;
  if (!token) return { items: [], error: "News service is not configured." };
  const to = new Date(), from = new Date(Date.now() - DAYS * 86400_000);
  const d = (x: Date) => x.toISOString().slice(0, 10);
  try {
    const res = await fetch(`https://finnhub.io/api/v1/company-news?${new URLSearchParams({ symbol, from: d(from), to: d(to), token })}`, { next: { revalidate: 600 } });
    if (!res.ok) return { items: [], error: `News service returned ${res.status}.` };
    const j = (await res.json()) as { headline?: string; source?: string; datetime?: number; url?: string }[];
    if (!Array.isArray(j)) return { items: [], error: "News service returned no list." };
    const items = j.filter((x) => x.headline && x.url && typeof x.datetime === "number" && x.datetime > 0)
      .map((x) => ({ kind: WIRE.test(x.source ?? "") ? ("press" as const) : ("news" as const), headline: x.headline!, source: x.source || "Unknown source", ts: x.datetime!, url: x.url! }));
    return { items };
  } catch {
    return { items: [], error: "News service is unreachable." };
  }
}

export async function cikFor(ticker: string): Promise<string | null> {
  const res = await fetch("https://www.sec.gov/files/company_tickers.json", { headers: { "User-Agent": UA }, next: { revalidate: 86400 } });
  if (!res.ok) return null;
  const j = (await res.json()) as Record<string, { cik_str: number; ticker: string }>;
  const hit = Object.values(j).find((c) => c.ticker.toUpperCase() === ticker.toUpperCase());
  return hit ? String(hit.cik_str) : null;
}

async function secFilings(ticker: string): Promise<{ items: NewsItem[]; error?: string }> {
  try {
    const cik = await cikFor(ticker);
    if (!cik) return { items: [] };
    const res = await fetch(`https://data.sec.gov/submissions/CIK${cik.padStart(10, "0")}.json`, { headers: { "User-Agent": UA }, next: { revalidate: 1800 } });
    if (!res.ok) return { items: [], error: `SEC returned ${res.status}.` };
    const r = ((await res.json()) as { filings: { recent: Record<string, string[]> } }).filings.recent;
    const cutoff = Date.now() - DAYS * 86400_000;
    const items: NewsItem[] = [];
    for (let i = 0; i < r.form.length && items.length < 20; i++) {
      const t = Date.parse(r.acceptanceDateTime?.[i] || r.filingDate[i]);
      if (!Number.isFinite(t) || t < cutoff) continue;
      const label = FORMS[r.form[i]];
      if (!label) continue;
      const what = r.form[i] === "8-K" ? (r.items?.[i] ?? "").split(",").map((c) => ITEMS[c.trim()]).filter(Boolean).slice(0, 2).join(", ") : "";
      items.push({ kind: "filing", headline: `${r.form[i]}: ${label}${what ? ` (${what})` : ""}`, source: "SEC EDGAR", ts: Math.floor(t / 1000), url: `https://www.sec.gov/Archives/edgar/data/${cik}/${r.accessionNumber[i].replace(/-/g, "")}/${r.primaryDocument[i]}` });
    }
    return { items };
  } catch {
    return { items: [], error: "SEC filings are unreachable." };
  }
}

export async function getNews(ticker: string): Promise<NewsResult> {
  const [n, f] = await Promise.all([finnhubNews(ticker), secFilings(ticker)]);
  const items = [...n.items, ...f.items].sort((a, b) => b.ts - a.ts);
  return { items, errors: [n.error, f.error].filter((x): x is string => !!x) };
}
