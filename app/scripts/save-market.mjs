// Save market data for offline demo mode and as the fallback when a live call fails (DEM-1, DEM-3).
// Run while online, from the app folder:   node --env-file=.env scripts/save-market.mjs            (all mapped companies)
//                                          node --env-file=.env scripts/save-market.mjs UBER LYFT   (some)
//                                          add --no-history to refresh only quote, fundamentals, profile and next earnings (keeps saved price bars)
// Needs FINNHUB_API_KEY and TWELVEDATA_API_KEY in .env. Writes data/market/<TICKER>.json. About text and employees are not on
// Finnhub's free plan: add them by hand under "profile" (and set "source" to "manual" if you filled the file in yourself).
import fs from "node:fs";
import { liveSymbol } from "../src/lib/listing.ts"; // live services only for US-primary listings (CCC on Finnhub is a different, Nasdaq company)
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
const fh = async (path, params) => {
  const r = await fetch(`https://finnhub.io/api/v1${path}?${new URLSearchParams({ ...params, token: process.env.FINNHUB_API_KEY })}`);
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return r.json();
};
const td = async (symbol, interval) => {
  const r = await fetch(`https://api.twelvedata.com/time_series?${new URLSearchParams({ symbol, interval, outputsize: "260", order: "ASC", apikey: process.env.TWELVEDATA_API_KEY })}`);
  const j = await r.json();
  if (j.status !== "ok") throw new Error(`history ${j.message ?? r.status}`);
  return j.values.map((v) => ({ t: Math.floor(Date.parse(v.datetime) / 1000), c: Number(v.close) })).filter((p) => Number.isFinite(p.t) && Number.isFinite(p.c));
};
const snap = JSON.parse(fs.readFileSync("data/snapshot.json", "utf8"));
const noHistory = process.argv.includes("--no-history"); // keep the daily/weekly bars already saved from the sheet exports
const wanted = process.argv.slice(2).filter((s) => !s.startsWith("--")).map((s) => s.toUpperCase());
const byTicker = new Map(snap.companies.filter((c) => c.ticker).map((c) => [c.ticker.toUpperCase(), c]));
const asked = wanted.length ? wanted : snap.companies.filter((c) => c.is_seed && c.ticker).map((c) => c.ticker);
const tickers = asked.filter((t) => {
  const c = byTicker.get(t.toUpperCase());
  if (c && liveSymbol(c)) return true;
  console.log(t, c ? "skipped: primary listing is not US, so a bare-ticker lookup could return another company" : "skipped: not in the snapshot, listing unknown");
  return false;
});
fs.mkdirSync("data/market", { recursive: true });
for (const t of tickers) {
  const file = `data/market/${t}.json`;
  const old = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  const out = { ...old, saved_at: new Date().toISOString().slice(0, 10), source: noHistory ? (old.source ?? "manual") : "finnhub+twelvedata" };
  const note = [];
  try { const q = await fh("/quote", { symbol: t }); out.quote = { price: q.c, change: q.d, changePct: q.dp, high: q.h, low: q.l, open: q.o, prevClose: q.pc, t: q.t || null }; } catch (e) { note.push(String(e.message)); }
  try {
    const [m, p] = await Promise.all([fh("/stock/metric", { symbol: t, metric: "all" }), fh("/stock/profile2", { symbol: t })]);
    const mm = m.metric ?? {};
    out.fundamentals = { marketCap: num(p.marketCapitalization) ?? num(mm.marketCapitalization), pe: num(mm.peTTM) ?? num(mm.peBasicExclExtraTTM), beta: num(mm.beta), high52: num(mm["52WeekHigh"]), low52: num(mm["52WeekLow"]), shares: num(p.shareOutstanding), eps: num(mm.epsTTM) ?? num(mm.epsBasicExclExtraItemsTTM), avgVolume: num(mm["10DayAverageTradingVolume"]), revGrowth: num(mm.revenueGrowthTTMYoy), grossMargin: num(mm.grossMarginTTM), opMargin: num(mm.operatingMarginTTM), netMargin: num(mm.netProfitMarginTTM), revPerShare: num(mm.revenuePerShareTTM), currentRatio: num(mm.currentRatioQuarterly), debtEquity: num(mm["totalDebt/totalEquityQuarterly"]) };
    out.profile = { ...(old.profile ?? {}), exchange: str(p.exchange), industry: str(p.finnhubIndustry), website: str(p.weburl) };
  } catch (e) { note.push(String(e.message)); }
  try { const c = await fh("/calendar/earnings", { symbol: t, from: new Date().toISOString().slice(0, 10), to: new Date(Date.now() + 120 * 864e5).toISOString().slice(0, 10) }); out.nextEarnings = str(c.earningsCalendar?.[0]?.date); } catch (e) { note.push(String(e.message)); }
  if (!noHistory) try { out.daily = await td(t, "1day"); await new Promise((r) => setTimeout(r, 8000)); out.weekly = await td(t, "1week"); await new Promise((r) => setTimeout(r, 8000)); } catch (e) { note.push(String(e.message)); }
  fs.writeFileSync(file, JSON.stringify(out));
  console.log(t, note.length ? `saved with gaps: ${note.join("; ")}` : "saved");
}
