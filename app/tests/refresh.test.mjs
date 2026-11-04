// Daily refresh rules for earnings dates (DEM-1, TRM-13): rejected dates never return, big moves wait for review.
import { test } from "node:test";
import assert from "node:assert/strict";
import { planEvents, parseCalendar, metricsRow, quarterKey } from "../src/lib/refresh-core.ts";

const cal = (date, q = 3, y = 2026, extra = {}) => parseCalendar([{ date, quarter: q, year: y, hour: "amc", ...extra }])[0];

test("a date the admin rejected is never brought back", () => {
  const a = planEvents([{ id: 1, event_date: "2026-11-04", detail: "Q3 2026", status: "rejected" }], [cal("2026-11-04")]);
  assert.deepEqual(a.map((x) => x.kind), ["skip"]);
});

test("the same promoted date is refreshed in place", () => {
  const a = planEvents([{ id: 7, event_date: "2026-11-05", detail: "Q3 2026, after market close", status: "promoted" }], [cal("2026-11-05")]);
  assert.equal(a[0].kind, "touch"); assert.equal(a[0].id, 7);
});

test("a small move of the same quarter is applied, a big one is staged", () => {
  const stored = [{ id: 3, event_date: "2026-11-17", detail: "Q3 2026", status: "promoted" }];
  assert.equal(planEvents(stored, [cal("2026-11-12")])[0].kind, "move");
  const big = planEvents(stored, [cal("2026-12-10")])[0];
  assert.equal(big.kind, "insert"); assert.equal(big.status, "staged");
});

test("a report that already happened moves the date even when the gap is large (Grab: Nov 17 stored, reported Nov 3)", () => {
  const a = planEvents([{ id: 9, event_date: "2026-11-17", detail: "Q3 2026", status: "promoted" }], [cal("2026-11-03", 3, 2026, { epsActual: 0.02 })]);
  assert.equal(a[0].kind, "move"); assert.equal(a[0].date, "2026-11-03");
});

test("a new quarter is promoted; a date already staged is left for review", () => {
  assert.equal(planEvents([], [cal("2027-02-02", 4)])[0].status, "promoted");
  assert.equal(planEvents([{ id: 2, event_date: "2027-02-02", detail: null, status: "staged" }], [cal("2027-02-02", 4)])[0].kind, "skip");
});

test("calendar parsing drops bad rows and reads the quarter", () => {
  assert.equal(parseCalendar([{ date: "bad" }, null, { date: "2026-11-04", quarter: 3, year: 2026, hour: "bmo" }]).length, 1);
  assert.equal(quarterKey("Q3 2026, before market open"), "Q3 2026");
  assert.equal(quarterKey(null), null);
});

test("metrics: empty metric payload gives no row; values are taken as given", () => {
  assert.equal(metricsRow({ metric: {} }, []), null);
  const r = metricsRow({ metric: { peTTM: 14.2, grossMarginTTM: "x" } }, [{ period: "2026-10-01", buy: 36 }, { period: "2026-11-01", buy: 37 }]);
  assert.equal(r.pe_ttm, 14.2); assert.equal(r.gross_margin, null); assert.equal(r.rec_buy, 37); assert.equal(r.rec_period, "2026-11-01");
});
