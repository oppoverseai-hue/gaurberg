// Server-side only. The key never reaches the browser.
const BASE = "https://finnhub.io/api/v1";

export type Quote = { price: number; change: number; changePct: number; high: number; low: number; open: number; prevClose: number; t: number | null };
export type Candles = { ok: true; points: { t: number; c: number }[] } | { ok: false; reason: string };

async function call(path: string, params: Record<string, string>) {
  const token = process.env.FINNHUB_API_KEY;
  if (!token) return { ok: false as const, reason: "Price service is not configured." };
  const qs = new URLSearchParams({ ...params, token }).toString();
  try {
    const res = await fetch(`${BASE}${path}?${qs}`, { next: { revalidate: 300 } });
    if (!res.ok) return { ok: false as const, reason: `Price service returned ${res.status}.` };
    return { ok: true as const, json: await res.json() };
  } catch {
    return { ok: false as const, reason: "Price service is unreachable." };
  }
}

export async function getQuote(symbol: string): Promise<{ ok: true; quote: Quote } | { ok: false; reason: string }> {
  const r = await call("/quote", { symbol });
  if (!r.ok) return r;
  const q = r.json;
  if (!q || typeof q.c !== "number" || q.c === 0) return { ok: false, reason: "No quote available." };
  return { ok: true, quote: { price: q.c, change: q.d, changePct: q.dp, high: q.h, low: q.l, open: q.o, prevClose: q.pc, t: typeof q.t === "number" && q.t > 0 ? q.t : null } };
}

export async function getCandles(symbol: string, days = 365): Promise<Candles> {
  const to = Math.floor(Date.now() / 1000);
  const from = to - days * 86400;
  const r = await call("/stock/candle", { symbol, resolution: "D", from: String(from), to: String(to) });
  if (!r.ok) return r;
  const j = r.json;
  if (!j || j.s !== "ok" || !Array.isArray(j.c)) return { ok: false, reason: "Price history is not available on the free plan." };
  return { ok: true, points: j.t.map((t: number, i: number) => ({ t, c: j.c[i] })) };
}

// Price history: Finnhub's free plan blocks candles (403), so fall back to Twelve Data's free plan.
export async function getHistory(symbol: string, days = 365, interval: "1day" | "1week" = "1day"): Promise<Candles> {
  const first = interval === "1day" ? await getCandles(symbol, days) : ({ ok: false, reason: "Weekly history needs the history service." } as Candles);
  if (first.ok) return first;
  const key = process.env.TWELVEDATA_API_KEY;
  if (!key) return first;
  try {
    const qs = new URLSearchParams({ symbol, interval, outputsize: "260", order: "ASC", apikey: key }).toString();
    const res = await fetch(`https://api.twelvedata.com/time_series?${qs}`, { next: { revalidate: 3600 } });
    if (!res.ok) return { ok: false, reason: `History service returned ${res.status}.` };
    const j = await res.json();
    if (j.status !== "ok" || !Array.isArray(j.values) || j.values.length === 0) {
      return { ok: false, reason: "History service returned no data." };
    }
    const points = j.values
      .map((v: { datetime: string; close: string }) => ({ t: Math.floor(Date.parse(v.datetime) / 1000), c: Number(v.close) }))
      .filter((p: { t: number; c: number }) => Number.isFinite(p.t) && Number.isFinite(p.c));
    return points.length ? { ok: true, points } : { ok: false, reason: "History service returned no data." };
  } catch {
    return { ok: false, reason: "History service is unreachable." };
  }
}

export type Fundamentals = {
  marketCap: number | null; pe: number | null; beta: number | null; high52: number | null; low52: number | null; shares: number | null;
  eps: number | null; avgVolume: number | null; revGrowth: number | null; grossMargin: number | null; opMargin: number | null; netMargin: number | null;
  revPerShare: number | null; currentRatio: number | null; debtEquity: number | null;
};
export type Profile = { exchange: string | null; industry: string | null; website: string | null };

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

// Fundamentals and profile from Finnhub's free endpoints (/stock/metric and /stock/profile2). Values are as Finnhub reports them;
// missing ones stay null. Market cap, shares and volume come back in millions. Finnhub's free plan has no company description or employee count.
export async function getFundamentals(symbol: string): Promise<{ ok: true; f: Fundamentals; profile: Profile } | { ok: false; reason: string }> {
  const [m, p] = await Promise.all([call("/stock/metric", { symbol, metric: "all" }), call("/stock/profile2", { symbol })]);
  if (!m.ok && !p.ok) return m;
  const mm = (m.ok ? m.json?.metric : null) ?? {};
  const pp = (p.ok ? p.json : null) ?? {};
  const f: Fundamentals = {
    marketCap: num(pp.marketCapitalization) ?? num(mm.marketCapitalization),
    pe: num(mm.peTTM) ?? num(mm.peBasicExclExtraTTM),
    beta: num(mm.beta),
    high52: num(mm["52WeekHigh"]), low52: num(mm["52WeekLow"]),
    shares: num(pp.shareOutstanding),
    eps: num(mm.epsTTM) ?? num(mm.epsBasicExclExtraItemsTTM),
    avgVolume: num(mm["10DayAverageTradingVolume"]),
    revGrowth: num(mm.revenueGrowthTTMYoy), grossMargin: num(mm.grossMarginTTM), opMargin: num(mm.operatingMarginTTM), netMargin: num(mm.netProfitMarginTTM),
    revPerShare: num(mm.revenuePerShareTTM),
    currentRatio: num(mm.currentRatioQuarterly), debtEquity: num(mm["totalDebt/totalEquityQuarterly"]),
  };
  const profile: Profile = { exchange: str(pp.exchange), industry: str(pp.finnhubIndustry), website: str(pp.weburl) };
  if (Object.values(f).every((v) => v === null)) return { ok: false, reason: "No fundamentals returned for this company." };
  return { ok: true, f, profile };
}

// Next earnings date, when Finnhub's free calendar has one.
export async function getNextEarnings(symbol: string): Promise<string | null> {
  const from = new Date().toISOString().slice(0, 10);
  const to = new Date(Date.now() + 120 * 86400000).toISOString().slice(0, 10);
  const r = await call("/calendar/earnings", { symbol, from, to });
  if (!r.ok) return null;
  const list = r.json?.earningsCalendar;
  return Array.isArray(list) && list.length ? str(list[0].date) : null;
}

export const fmtBig = (millions: number) => (millions >= 1e6 ? `$${(millions / 1e6).toFixed(2)}T` : millions >= 1e3 ? `$${(millions / 1e3).toFixed(2)}B` : `$${millions.toFixed(0)}M`);
export const fmtShares = (millions: number) => (millions >= 1e3 ? `${(millions / 1e3).toFixed(2)}B` : `${millions.toFixed(1)}M`);
