// Live lookups must never resolve a non-US-primary company to another company (DEM-3, TRM-9).
// Finnhub and SEC look up by bare ticker: "CCC" there is CCC Intelligent Solutions (Nasdaq), not Computacenter (LSE).
// Run: npm test   (node's built-in runner; needs Node 22.6+ for the .ts import)
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { liveSymbol, isUSListed } from "../src/lib/listing.ts";

const snap = JSON.parse(fs.readFileSync(new URL("../data/snapshot.json", import.meta.url), "utf8"));
const seed = snap.companies.filter((c) => c.is_seed && c.ticker);
const byTicker = new Map(seed.map((c) => [c.ticker, c]));

test("CCC and the other London and Hong Kong names never get a live symbol", () => {
  for (const t of ["CCC", "SCT", "BYIT", "AML", "VOD", "0992"]) {
    const c = byTicker.get(t);
    assert.ok(c, `${t} is in the snapshot`);
    assert.equal(liveSymbol(c), null, `${t} (${(c.markets ?? []).join("/")}) must not be looked up live`);
  }
  // Even if the markets list were missing, a bare ticker alone is never enough.
  assert.equal(liveSymbol({ ticker: "CCC" }), null);
  assert.equal(liveSymbol({ ticker: "CCC", markets: [] }), null);
});

test("every company follows the rule: live only when the primary market is US", () => {
  for (const c of seed) assert.equal(liveSymbol(c), isUSListed(c.markets) ? c.ticker : null, c.ticker);
  assert.equal(liveSymbol({ ticker: "BIDU", markets: ["US", "HKEX"] }), "BIDU");
  assert.equal(liveSymbol({ ticker: "VOD", markets: ["LSE", "US"] }), null, "a US ADR does not make a London company US-primary");
});

// Static guard: the only code that talks to Finnhub, Twelve Data or SEC by ticker is in these files, and there it passes `sym`
// (the gated symbol from liveSymbol). Anything new must go through the gate too.
const SRC = new URL("../src/", import.meta.url).pathname;
const files = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(d, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [path.join(d, e.name)] : []));
const rel = (f) => path.relative(SRC, f);

test("no file calls Finnhub, Twelve Data or the SEC ticker lookup except the gated ones", () => {
  const ALLOWED_FETCH = new Set(["lib/finnhub.ts", "lib/news.ts", "lib/indices.ts"]); // indices.ts: fixed index symbols, not companies
  const LOW = /\b(getQuote|getCandles|getHistory|getFundamentals|getNextEarnings|finnhubNews|secFilings|cikFor)\(/;
  const LOW_ALLOWED = new Set(["lib/finnhub.ts", "lib/market.ts", "lib/news.ts", "lib/insiders.ts"]);
  for (const f of files(SRC)) {
    const s = fs.readFileSync(f, "utf8"), r = rel(f);
    if (/finnhub\.io|api\.twelvedata\.com|sec\.gov\/files\/company_tickers/.test(s)) assert.ok(ALLOWED_FETCH.has(r), `${r} calls a market-data service directly`);
    if (LOW.test(s)) assert.ok(LOW_ALLOWED.has(r), `${r} calls a ticker lookup directly; use getMarket/getNews/getInsiderTrades with the company`);
  }
});

test("inside the gated files, live calls use the gated symbol", () => {
  const market = fs.readFileSync(path.join(SRC, "lib/market.ts"), "utf8");
  for (const fn of ["getQuote", "getHistory", "getFundamentals", "getNextEarnings"]) {
    for (const m of market.matchAll(new RegExp(`${fn}\\(([^,)]+)`, "g"))) assert.equal(m[1].trim(), "sym", `market.ts ${fn}(${m[1]})`);
  }
  const news = fs.readFileSync(path.join(SRC, "lib/news.ts"), "utf8");
  assert.match(news, /Promise\.all\(\[finnhubNews\(sym\), secFilings\(sym\)\]\)/);
  const ins = fs.readFileSync(path.join(SRC, "lib/insiders.ts"), "utf8");
  assert.match(ins, /cikFor\(sym\)/);
  assert.match(market + news + ins, /liveSymbol\(co\)/);
});
