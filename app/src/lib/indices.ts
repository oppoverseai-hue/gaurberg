// Index ticker data (server only). Tries each index on Finnhub, then Twelve Data. An index that no provider answers is left out, never filled in.
export type IndexQuote = { id: string; label: string; price: number; change: number; changePct: number; source: string };
export type Probe = { id: string; provider: string; symbol: string; ok: boolean; note: string };

const INDICES = [
  { id: "SPX", label: "S&P 500", finnhub: ["^GSPC", "SPY"], twelve: ["SPX", "GSPC"] },
  { id: "NDX", label: "Nasdaq 100", finnhub: ["^NDX", "QQQ"], twelve: ["NDX", "IXIC"] },
  { id: "FTSE", label: "FTSE 100", finnhub: ["^FTSE"], twelve: ["FTSE", "UKX"] },
  { id: "HSI", label: "Hang Seng", finnhub: ["^HSI"], twelve: ["HSI"] },
];
const PROXY = new Set(["SPY", "QQQ"]);

async function finnhub(sym: string): Promise<{ price: number; change: number; changePct: number } | string> {
  const k = process.env.FINNHUB_API_KEY; if (!k) return "no key";
  try {
    const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${k}`, { next: { revalidate: 300 } });
    if (!r.ok) return `HTTP ${r.status}`;
    const j = await r.json();
    return typeof j.c === "number" && j.c > 0 ? { price: j.c, change: j.d ?? 0, changePct: j.dp ?? 0 } : "empty";
  } catch { return "unreachable"; }
}
async function twelve(sym: string): Promise<{ price: number; change: number; changePct: number } | string> {
  const k = process.env.TWELVEDATA_API_KEY; if (!k) return "no key";
  try {
    const r = await fetch(`https://api.twelvedata.com/quote?symbol=${encodeURIComponent(sym)}&apikey=${k}`, { next: { revalidate: 300 } });
    const j = await r.json();
    if (j.status === "error" || j.code) return `${j.code ?? r.status}: ${String(j.message ?? "error").slice(0, 80)}`;
    const price = Number(j.close), change = Number(j.change), pct = Number(j.percent_change);
    return Number.isFinite(price) && price > 0 ? { price, change: Number.isFinite(change) ? change : 0, changePct: Number.isFinite(pct) ? pct : 0 } : "empty";
  } catch { return "unreachable"; }
}

export async function getIndices(): Promise<{ items: IndexQuote[]; probes: Probe[] }> {
  const probes: Probe[] = [];
  const items = (await Promise.all(INDICES.map(async (ix) => {
    for (const [provider, fn, syms] of [["finnhub", finnhub, ix.finnhub], ["twelvedata", twelve, ix.twelve]] as const) {
      for (const s of syms) {
        const r = await fn(s);
        probes.push({ id: ix.id, provider, symbol: s, ok: typeof r !== "string", note: typeof r === "string" ? r : "ok" });
        if (typeof r !== "string") return { id: ix.id, label: PROXY.has(s) ? `${ix.label} (ETF ${s})` : ix.label, ...r, source: provider } as IndexQuote;
      }
    }
    return null;
  }))).filter((x): x is IndexQuote => !!x);
  return { items, probes };
}
