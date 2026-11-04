// "Around this company" (GRF-18): roles read in the link's direction, report windows, large moves only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { roleOf, neighbours, reports, moves } from "../src/lib/around-core.ts";

const U = { id: 1, name: "Uber", ticker: "UBER", is_seed: true }, L = { id: 2, name: "Lyft", ticker: "LYFT", is_seed: true }, A = { id: 3, name: "Aurora", ticker: "AUR", is_seed: true };
const rel = (t, s, g) => ({ id: Math.random(), relationship_type: t, source: s, target: g, evidence: [], status: "promoted" });

test("roles follow the link direction", () => {
  assert.equal(roleOf(rel("supplies", A, U), 1), "supplier");
  assert.equal(roleOf(rel("supplies", U, A), 1), "customer");
  assert.equal(roleOf(rel("sells_to", A, U), 1), "supplier");
  assert.equal(roleOf(rel("invests", U, A), 1), "stake held");
  assert.equal(roleOf(rel("invests", A, U), 1), "investor");
  assert.equal(roleOf(rel("competes", L, U), 1), "competitor");
});

test("one neighbour per company with all its roles", () => {
  const ns = neighbours([rel("partners", U, A), rel("invests", U, A), rel("competes", U, L)], 1);
  assert.equal(ns.length, 2);
  assert.deepEqual(ns.find((n) => n.co.id === 3).roles, ["partner", "stake held"]);
});

test("reports: today first, then upcoming soonest first, then reported; outside the window dropped", () => {
  const ns = neighbours([rel("competes", U, L), rel("partners", U, A)], 1);
  const r = reports(ns, [
    { company_id: 2, event_date: "2026-11-05", detail: "Q3 2026, after market close" },
    { company_id: 3, event_date: "2026-11-04", detail: null },
    { company_id: 3, event_date: "2026-10-20", detail: null },
    { company_id: 2, event_date: "2026-12-30", detail: null },
    { company_id: 99, event_date: "2026-11-06", detail: null },
  ], "2026-11-04");
  assert.deepEqual(r.map((x) => [x.co.name, x.when]), [["Aurora", "today"], ["Lyft", "upcoming"]]);
});

test("moves: only the last two closes count, and only 4% or more", () => {
  const ns = neighbours([rel("competes", U, L), rel("partners", U, A)], 1);
  const m = moves(ns, [
    { company_id: 2, ts: "2026-11-02T00:00:00Z", close: 10 }, { company_id: 2, ts: "2026-11-03T00:00:00Z", close: 10.5 },
    { company_id: 3, ts: "2026-11-02T00:00:00Z", close: 10 }, { company_id: 3, ts: "2026-11-03T00:00:00Z", close: 10.3 },
  ]);
  assert.equal(m.length, 1); assert.equal(m[0].co.name, "Lyft"); assert.equal(Math.round(m[0].pct), 5);
});

test("moves: two closes far apart are not treated as one day's move", () => {
  const ns = neighbours([rel("competes", U, L)], 1);
  assert.equal(moves(ns, [{ company_id: 2, ts: "2026-10-21T00:00:00Z", close: 10 }, { company_id: 2, ts: "2026-11-03T00:00:00Z", close: 12 }]).length, 0);
});
