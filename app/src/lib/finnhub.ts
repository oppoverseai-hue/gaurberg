// Server-side only. The key never reaches the browser.
const BASE = "https://finnhub.io/api/v1";

export type Quote = { price: number; change: number; changePct: number; high: number; low: number; open: number; prevClose: number };
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
  return { ok: true, quote: { price: q.c, change: q.d, changePct: q.dp, high: q.h, low: q.l, open: q.o, prevClose: q.pc } };
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
