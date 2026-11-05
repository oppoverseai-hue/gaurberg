// Who is exposed as a quant matrix (GRF-19, GRF-17): points only from measured co-movement, every gap stated, counts as on the map.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildExposure, buildMatrix, noPointReason, axisDomain, ticks, KINDS } from "../src/lib/exposure-core.ts";
import { buildNodes, pageOf, SIDES } from "../src/lib/graph.ts";
import { comove, MIN_DAYS } from "../src/lib/comove-core.ts";

const { rels } = JSON.parse(fs.readFileSync(new URL("./fixtures/map-links-2026-11-05.json", import.meta.url), "utf8"));
const UBER = rels.flatMap((r) => [r.source, r.target]).find((c) => c.ticker === "UBER" && c.is_seed);
const uberRels = rels.filter((r) => r.status === "promoted" && (r.source.id === UBER.id || r.target.id === UBER.id));
const rowsOf = (e) => [...KINDS.flatMap((k) => e.ranked[k]), ...e.unweighted, ...e.partners, ...e.competitors];
// The saved link fixture has no markets field; the live rows do (the links query selects it). US-primary seeds get it here.
const US = new Set(["UBER", "LYFT", "DASH", "AUR", "LCID", "GOOGL", "AMZN", "TSLA", "CART", "LIME", "GRAB", "NBIS", "BIDU", "PONY"]);
for (const r of rels) for (const c of [r.source, r.target]) if (c.is_seed && US.has(c.ticker)) c.markets = ["US"];

// Synthetic closes: n trading days of a known pattern (no network, no stored data).
const series = (n, f) => Array.from({ length: n + 1 }, (_, i) => ({ ts: new Date(Date.UTC(2026, 0, 1) + i * 864e5).toISOString(), close: f(i) }));
const focal = series(250, (i) => 100 + 10 * Math.sin(i / 7) + i * 0.05);
const ok = comove(focal, series(250, (i) => 50 + 5 * Math.sin(i / 7) + i * 0.02));
const short = comove(focal, focal.slice(-100).map((c, i) => ({ ts: c.ts, close: 50 + Math.sin(i) }))); // 100 shared days, 99 returns

test("a point only with at least 120 shared days; the shortfall is the stated reason", () => {
  assert.ok(ok.ok && ok.days >= MIN_DAYS);
  assert.ok(!short.ok && short.days < MIN_DAYS);
  const e = buildExposure(UBER.id, uberRels), rows = rowsOf(e);
  const lyft = rows.find((x) => x.co.ticker === "LYFT"), dash = rows.find((x) => x.co.ticker === "DASH");
  const m = buildMatrix(rows, { [lyft.co.id]: ok, [dash.co.id]: short });
  assert.deepEqual(m.points.map((p) => p.id), [lyft.co.id]);
  assert.match(m.excluded.find((x) => x.id === dash.co.id).reason, /Not enough shared price history \(99 of 120/);
});

test("every excluded company has a stated reason; groups are never plotted", () => {
  const e = buildExposure(UBER.id, uberRels), rows = rowsOf(e);
  const all = Object.fromEntries(rows.map((x) => [x.co.id, ok])); // even if a group had a measurement, it is not plotted
  const m = buildMatrix(rows, all);
  assert.equal(m.points.length + m.excluded.length, rows.length, "every linked company is either a point or excluded");
  for (const x of m.excluded) assert.ok(typeof x.reason === "string" && x.reason.length > 10, `${x.id} has a reason`);
  const groups = rows.filter((x) => x.co.entity_type === "segment_group");
  assert.ok(groups.length > 0, "Uber has groups (drivers, riders)");
  for (const g of groups) assert.ok(!m.points.some((p) => p.id === g.co.id) && /group/i.test(m.excluded.find((x) => x.id === g.co.id).reason));
  const noTicker = rows.find((x) => !x.co.ticker && x.co.entity_type !== "segment_group");
  assert.match(noPointReason(noTicker.co, ok), /No ticker/);
});

test("chip counts equal the groupOf counts and the map's pagers, for every seed company", () => {
  const seeds = [...new Map(rels.flatMap((r) => [r.source, r.target]).filter((c) => c.is_seed && c.ticker).map((c) => [c.id, c])).values()];
  for (const f of seeds) {
    const promoted = rels.filter((r) => r.status === "promoted" && (r.source.id === f.id || r.target.id === f.id));
    const m = buildMatrix(rowsOf(buildExposure(f.id, promoted)), {});
    const nodes = buildNodes(promoted, f.id);
    for (const s of SIDES) assert.equal(m.counts[s], pageOf(nodes, s, 0).total, `${f.ticker} ${s}`);
  }
});

test("no NaN or infinite value reaches the chart", () => {
  const bad = { ok: true, corr: NaN, beta: Infinity, days: 200, from: "a", to: "b" };
  const e = buildExposure(UBER.id, uberRels), rows = rowsOf(e);
  const lyft = rows.find((x) => x.co.ticker === "LYFT");
  const m = buildMatrix(rows, { [lyft.co.id]: bad });
  assert.equal(m.points.length, 0);
  assert.match(m.excluded.find((x) => x.id === lyft.co.id).reason, /could not be measured/);
  for (const d of [axisDomain([], 0.2), axisDomain([NaN, Infinity, 0.58], 0.2), axisDomain([-0.3, 1.7], 0.25)]) {
    assert.ok(d.every(Number.isFinite) && d[0] < d[1] && d[0] <= 0 && d[1] >= 0, String(d));
    assert.ok(ticks(d, 0.2).every(Number.isFinite));
  }
  assert.deepEqual(axisDomain([0.58, 0.31], 0.2), [-0.2, 0.8]);
});
