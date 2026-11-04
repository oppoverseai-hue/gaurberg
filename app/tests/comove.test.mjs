// Co-movement rules (GRF-19), tested on real closes.
// fixtures/comove-uber-lyft.json: UBER and LYFT closes from price_cache, 2025-10-22 to 2026-10-21, read from Supabase on 2026-11-04.
// The expected figures were computed in Postgres on the same rows (regr_slope and corr of simple daily returns).
// Run: npm test   (node's built-in runner; needs Node 22.6+ for the .ts import)
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { comove, comoveAll, comoveText, comoveWidth, MIN_DAYS } from "../src/lib/comove-core.ts";

const fx = JSON.parse(fs.readFileSync(new URL("./fixtures/comove-uber-lyft.json", import.meta.url), "utf8"));
const rows = (a) => a.map(([ts, close]) => ({ ts, close }));
const UBER = rows(fx.UBER), LYFT = rows(fx.LYFT);

test("LYFT on UBER, Oct 22, 2025 to Oct 21, 2026: beta 0.776, correlation 0.584, 250 days", () => {
  const c = comove(UBER, LYFT);
  assert.ok(c.ok);
  assert.equal(c.days, 250);
  assert.equal(c.from, "2025-10-22");
  assert.equal(c.to, "2026-10-21");
  assert.ok(Math.abs(c.beta - 0.776200439) < 1e-6, `beta ${c.beta}`);
  assert.ok(Math.abs(c.corr - 0.584250301) < 1e-6, `corr ${c.corr}`);
  assert.equal(comoveText(c, "Uber"), "Moves 0.78% per 1% of Uber · correlation 0.58 · last 12 months");
});

test("only the last 250 shared days are used", () => {
  const extra = [{ ts: "2025-10-01", close: 50 }, { ts: "2025-10-02", close: 500 }];
  assert.deepEqual(comove([...extra, ...UBER], [...extra, ...LYFT]), comove(UBER, LYFT));
});

test("only days both companies traded count; timestamps are compared by day", () => {
  const gappy = LYFT.filter((_, i) => i % 2 === 0).map((c) => ({ ...c, ts: `${c.ts}T20:00:00+00:00` }));
  const c = comove(UBER, gappy);
  assert.ok(c.ok);
  assert.equal(c.days, 125);
});

test("fewer than 120 shared days is a stated gap, never a figure", () => {
  const short = comove(UBER.slice(-MIN_DAYS), LYFT.slice(-MIN_DAYS));
  assert.equal(short.ok, false);
  assert.equal(short.days, MIN_DAYS - 1);
  assert.equal(comoveText(short, "Uber"), "Not enough shared price history (119 of 120 trading days)");
  assert.equal(comove(UBER, []).ok, false);
  assert.equal(comoveText(comove(UBER, []), "Uber"), "No price history saved");
  const ok = comove(UBER.slice(-(MIN_DAYS + 1)), LYFT.slice(-(MIN_DAYS + 1)));
  assert.ok(ok.ok);
  assert.match(comoveText(ok, "Uber"), /· last 120 trading days$/);
});

test("a company that moves exactly twice as much has beta 2 and correlation 1", () => {
  const a = UBER.slice(0, 200);
  const b = a.map((c, i) => ({ ts: c.ts, close: i === 0 ? 10 : 0 }));
  for (let i = 1; i < a.length; i++) b[i].close = b[i - 1].close * (1 + 2 * (a[i].close / a[i - 1].close - 1));
  const c = comove(a, b);
  assert.ok(c.ok);
  assert.ok(Math.abs(c.beta - 2) < 1e-9 && Math.abs(c.corr - 1) < 1e-9);
});

test("a flat price is a gap, not a zero", () => {
  const flat = UBER.map((c) => ({ ts: c.ts, close: 5 }));
  assert.equal(comove(UBER, flat).ok, false);
});

test("comoveAll skips the focal company; width grows only with positive correlation", () => {
  const all = comoveAll(1, [1, 20, 99], { 1: UBER, 20: LYFT });
  assert.deepEqual(Object.keys(all), ["20", "99"]);
  assert.equal(all[99].ok, false);
  assert.ok(comoveWidth(all[20]) > 1.5);
  assert.equal(comoveWidth(all[99]), 1.5);
  assert.equal(comoveWidth(undefined), 1.5);
  assert.equal(comoveWidth({ ok: true, beta: -1, corr: -0.5, days: 250, from: "", to: "" }), 1.5);
});
