// Index ticker data (server only). For each index it tries real index symbols on every provider first, ETF proxies last.
// An index that nothing answers is left out, never filled in. EODHD's free plan is about 20 calls a day, so it goes last and results are cached 15 minutes.
export type IndexQuote = { id: string; label: string; price: number; change: number; changePct: number; source: string };
export type Probe = { id: string; provider: string; symbol: string; ok: boolean; note: string };
type Q = { price: number; change: number; changePct: number };
type Fn = (sym: string) => Promise<Q | string>;

const INDICES = [
  { id: "SPX", label: "S&P 500", syms: { finnhub: "^GSPC", twelvedata: "SPX", fmp: "^GSPC", eodhd: "GSPC.INDX" }, proxy: "SPY" },
  { id: "NDX", label: "Nasdaq 100", syms: { finnhub: "^NDX", twelvedata: "NDX", fmp: "^NDX", eodhd: "NDX.INDX" }, proxy: "QQQ" },
  { id: "FTSE", label: "FTSE 100", syms: { finnhub: "^FTSE", twelvedata: "FTSE", fmp: "^FTSE", eodhd: "FTSE.INDX" }, proxy: null },
  { id: "N225", label: "Nikkei 225", syms: { finnhub: "^N225", twelvedata: "N225", fmp: "^N225", eodhd: "N225.INDX" }, proxy: null },
  { id: "DAX", label: "DAX", syms: { finnhub: "^GDAXI", twelvedata: "DAX", fmp: "^GDAXI", eodhd: "GDAXI.INDX" }, proxy: null },
  { id: "HSI", label: "Hang Seng", syms: { finnhub: "^HSI", twelvedata: "HSI", fmp: "^HSI", eodhd: "HSI.INDX" }, proxy: "EWH" },
] as const;
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const RV = { next: { revalidate: 900 } };

const finnhub: Fn = async (s) => {
  const k = process.env.FINNHUB_API_KEY; if (!k) return "no key";
  try {
    const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(s)}&token=${k}`, RV);
    if (!r.ok) return `HTTP ${r.status}`;
    const j = await r.json();
    return typeof j.c === "number" && j.c > 0 ? { price: j.c, change: j.d ?? 0, changePct: j.dp ?? 0 } : "empty";
  } catch { return "unreachable"; }
};
const twelvedata: Fn = async (s) => {
  const k = process.env.TWELVEDATA_API_KEY; if (!k) return "no key";
  try {
    const r = await fetch(`https://api.twelvedata.com/quote?symbol=${encodeURIComponent(s)}&apikey=${k}`, RV);
    const j = await r.json();
    if (j.status === "error" || j.code) return `${j.code ?? r.status}: ${String(j.message ?? "error").slice(0, 80)}`;
    const p = num(j.close);
    return p && p > 0 ? { price: p, change: num(j.change) ?? 0, changePct: num(j.percent_change) ?? 0 } : "empty";
  } catch { return "unreachable"; }
};
const fmp: Fn = async (s) => {
  const k = process.env.FMP_API_KEY; if (!k) return "no key";
  try {
    const r = await fetch(`https://financialmodelingprep.com/stable/quote?symbol=${encodeURIComponent(s)}&apikey=${k}`, RV);
    const t = await r.text();
    if (!r.ok) return `HTTP ${r.status}: ${t.slice(0, 80)}`;
    let j: unknown; try { j = JSON.parse(t); } catch { return `not json: ${t.slice(0, 60)}`; }
    const o = Array.isArray(j) ? j[0] : j as Record<string, unknown>;
    if (!o) return "empty";
    const p = num((o as Record<string, unknown>).price);
    if (!p || p <= 0) return `empty: ${t.slice(0, 80)}`;
    const x = o as Record<string, unknown>;
    return { price: p, change: num(x.change) ?? 0, changePct: num(x.changePercentage ?? x.changesPercentage) ?? 0 };
  } catch { return "unreachable"; }
};
const eodhd: Fn = async (s) => {
  const k = process.env.EODHD_API_KEY; if (!k) return "no key";
  try {
    const r = await fetch(`https://eodhd.com/api/real-time/${encodeURIComponent(s)}?api_token=${k}&fmt=json`, RV);
    const t = await r.text();
    if (!r.ok) return `HTTP ${r.status}: ${t.slice(0, 80)}`;
    let j: Record<string, unknown>; try { j = JSON.parse(t); } catch { return `not json: ${t.slice(0, 60)}`; }
    const p = num(j.close);
    return p && p > 0 ? { price: p, change: num(j.change) ?? 0, changePct: num(j.change_p) ?? 0 } : `empty: ${t.slice(0, 80)}`;
  } catch { return "unreachable"; }
};
const PROVIDERS = [["finnhub", finnhub], ["twelvedata", twelvedata], ["fmp", fmp], ["eodhd", eodhd]] as const;

// probe=true tries every provider and symbol so the admin can see what answers; otherwise it stops at the first answer.
export async function getIndices(probe = false): Promise<{ items: IndexQuote[]; probes: Probe[] }> {
  const probes: Probe[] = [];
  const items = (await Promise.all(INDICES.map(async (ix) => {
    let found: IndexQuote | null = null;
    const attempts: [string, Fn, string, boolean][] = [...PROVIDERS.map(([n, f]) => [n, f, ix.syms[n], false] as [string, Fn, string, boolean])];
    if (ix.proxy) attempts.push(["finnhub", finnhub, ix.proxy, true]);
    for (const [provider, fn, sym, isProxy] of attempts) {
      if (found && !probe) break;
      const r = await fn(sym);
      probes.push({ id: ix.id, provider, symbol: sym, ok: typeof r !== "string", note: typeof r === "string" ? r : "ok" });
      if (!found && typeof r !== "string") found = { id: ix.id, label: isProxy ? `${ix.label} (ETF ${sym})` : ix.label, ...r, source: provider };
    }
    return found;
  }))).filter((x): x is IndexQuote => !!x);
  return { items, probes };
}
