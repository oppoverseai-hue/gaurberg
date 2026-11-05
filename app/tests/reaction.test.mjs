// Earnings-day reaction (GRF-20): the reaction-day rule from the 8-K acceptance time, moves from stored closes, and the
// guarantee that the daily refresh cannot reject or overwrite the SEC report-date rows.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { nyParts, timingOf, reactionDay, moveOn, secDetail, parseSecEvent, lastReports } from "../src/lib/reaction-core.ts";
import { planEvents, refreshOwns, REFRESH_SOURCE } from "../src/lib/refresh-core.ts";

// Trading days around the examples (New York): Thu 30 Oct, Mon 2 Nov ... Fri 6 Nov 2026; 26 Nov 2026 is Thanksgiving.
const DAYS = ["2026-10-29", "2026-10-30", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-25", "2026-11-27"];
const FILING = "https://www.sec.gov/Archives/edgar/data/1543151/000154315126000099/uber-20261104.htm";

test("New York time follows daylight saving (EDT until Nov 1, 2026; EST after)", () => {
  assert.deepEqual(nyParts("2026-08-05T10:56:00Z"), { date: "2026-08-05", minutes: 6 * 60 + 56, time: "06:56" });
  assert.deepEqual(nyParts("2026-11-04T11:55:00Z"), { date: "2026-11-04", minutes: 6 * 60 + 55, time: "06:55" });
  assert.equal(nyParts("2026-11-05T03:30:00Z").date, "2026-11-04", "late evening in New York is still the 4th");
});

test("timing: before 09:30 ET is before the open, from 16:00 ET after the close, anything between is market hours", () => {
  assert.equal(timingOf("2026-08-05T13:29:00Z"), "before_open"); // 09:29 EDT
  assert.equal(timingOf("2026-08-05T13:30:00Z"), "market_hours"); // 09:30 EDT
  assert.equal(timingOf("2026-08-05T19:59:00Z"), "market_hours"); // 15:59 EDT
  assert.equal(timingOf("2026-08-05T20:00:00Z"), "after_close"); // 16:00 EDT
  assert.equal(timingOf("2026-11-04T14:29:00Z"), "before_open"); // 09:29 EST
  assert.equal(timingOf("2026-11-04T21:00:00Z"), "after_close"); // 16:00 EST
});

test("reaction day: before the open is that day against the previous close; after the close is the next trading day", () => {
  const bmo = reactionDay("2026-11-04T11:55:00Z", DAYS);
  assert.equal(bmo.kind, "day"); assert.equal(bmo.day, "2026-11-04"); assert.equal(bmo.prev, "2026-11-03"); assert.equal(bmo.timing, "before_open");
  const fri = reactionDay("2026-10-30T20:05:00Z", DAYS); // Friday after the close -> Monday
  assert.deepEqual([fri.day, fri.prev], ["2026-11-02", "2026-10-30"]);
  const mon = reactionDay("2026-11-02T12:00:00Z", DAYS); // Monday before the open -> Monday against Friday
  assert.deepEqual([mon.day, mon.prev], ["2026-11-02", "2026-10-30"]);
  const holiday = reactionDay("2026-11-26T12:00:00Z", DAYS); // before the open on Thanksgiving -> Friday against Wednesday
  assert.deepEqual([holiday.day, holiday.prev], ["2026-11-27", "2026-11-25"]);
  assert.match(holiday.rule, /not a trading day/);
});

test("market hours and days not yet stored are flagged, never guessed", () => {
  const mh = reactionDay("2026-11-04T16:00:00Z", DAYS); // 11:00 EST
  assert.equal(mh.kind, "flag"); assert.match(mh.reason, /during market hours/);
  const late = reactionDay("2026-11-27T21:30:00Z", DAYS); // after the close on the last stored day
  assert.equal(late.kind, "flag"); assert.match(late.reason, /no stored close yet/);
  const gap = reactionDay("2026-11-06T21:30:00Z", DAYS); // the next stored close is 19 days later: days missing from the store
  assert.equal(gap.kind, "flag"); assert.match(gap.reason, /trading days between are not stored/);
  const first = reactionDay("2026-10-29T12:00:00Z", DAYS);
  assert.equal(first.kind, "flag"); assert.match(first.reason, /No stored close before/);
});

test("a move needs both stored closes; a missing one is named, never filled", () => {
  const r = reactionDay("2026-11-04T11:55:00Z", DAYS);
  assert.ok(Math.abs(moveOn(new Map([["2026-11-03", 100], ["2026-11-04", 107]]), r).pct - 7) < 1e-9);
  assert.deepEqual(moveOn(new Map([["2026-11-04", 107]]), r), { missing: "No stored close for 2026-11-03" });
  assert.deepEqual(moveOn(new Map([["2026-11-03", 100]]), r), { missing: "No stored close for 2026-11-04" });
  assert.deepEqual(moveOn(new Map(), r), { missing: "No stored closes for 2026-11-03 or 2026-11-04" });
  assert.match(moveOn(new Map([["2026-11-03", 100], ["2026-11-04", 107]]), reactionDay("2026-11-04T16:00:00Z", DAYS)).missing, /market hours/);
});

test("stored SEC rows round-trip; other sources are not report dates for this view", () => {
  const d = secDetail("Q3 2026", "2026-11-04T11:55:00Z");
  assert.equal(d, "Q3 2026, before market open; 8-K accepted 2026-11-04T11:55:00Z");
  assert.deepEqual(parseSecEvent(FILING, d), { quarter: "Q3 2026", acceptedUtc: "2026-11-04T11:55:00Z", url: FILING });
  assert.equal(parseSecEvent("finnhub", d), null);
  assert.equal(parseSecEvent(FILING, "Q3 2026, after market close"), null, "no acceptance time, no reaction day");
  const rows = [
    { event_date: "2026-11-04", source: FILING, detail: d },
    { event_date: "2026-11-04", source: "finnhub", detail: "Q3 2026, after market close" },
    ...["2026-08-05", "2026-05-06", "2026-02-04", "2025-11-04"].map((x) => ({ event_date: x, source: FILING.replace("uber-20261104", `uber-${x}`), detail: secDetail("Qx", `${x}T10:56:00Z`) })),
  ];
  assert.deepEqual(lastReports(rows).map((x) => x.date), ["2026-11-04", "2026-08-05", "2026-05-06", "2026-02-04"]);
});

test("the daily refresh cannot reject or overwrite SEC report-date rows", () => {
  const stored = [
    { id: 1, event_date: "2026-11-04", detail: secDetail("Q3 2026", "2026-11-04T11:55:00Z"), status: "promoted", source: FILING },
    { id: 2, event_date: "2026-08-05", detail: secDetail("Q2 2026", "2026-08-05T10:56:00Z"), status: "staged", source: FILING },
  ];
  // The calendar lists the same date and the same quarter as the promoted SEC row.
  const cal = [{ date: "2026-11-04", quarter: 3, year: 2026, hour: "amc", reported: true }, { date: "2026-08-05", quarter: 2, year: 2026, hour: "bmo", reported: true }];
  const actions = planEvents(stored.filter(refreshOwns), cal);
  assert.ok(actions.every((a) => !("id" in a)), "no action names an SEC row");
  assert.ok(actions.every((a) => a.kind === "insert"), "the refresh adds its own rows beside them");
  // Without the filter, the refresh would rewrite the SEC row's detail: the filter is what protects it.
  assert.ok(planEvents(stored, cal).some((a) => a.kind === "touch" && a.id === 1));
  // The route reads and writes its own source only, and changes rows only by the ids planEvents returns.
  const route = fs.readFileSync(new URL("../src/app/api/cron/refresh/route.ts", import.meta.url), "utf8");
  assert.match(route, /from\("company_events"\)\.select\([^)]*\)\.eq\("company_id", c\.id\)\.eq\("event_type", "earnings"\)\.eq\("source", REFRESH_SOURCE\)/);
  assert.match(route, /from\("company_events"\)\.insert\(\{[^}]*source: REFRESH_SOURCE/);
  const updates = route.match(/from\("company_events"\)\.update\([^;]*/g) ?? [];
  assert.ok(updates.length > 0 && updates.every((u) => /\.eq\("id", a\.id\)/.test(u)), "updates only by planned id");
  assert.ok(!/from\("company_events"\)\.delete/.test(route), "never deletes");
  assert.equal(REFRESH_SOURCE, "finnhub");
});

test("table: the focal company first, then linked companies with stored closes; the rest are counted, not listed", async () => {
  const { reactionTable } = await import("../src/lib/reaction-core.ts");
  const reports = lastReports([{ event_date: "2026-11-04", source: FILING, detail: secDetail("Q3 2026", "2026-11-04T11:55:00Z") }]);
  const closes = new Map([[1, new Map([["2026-11-03", 100], ["2026-11-04", 90]])], [2, new Map([["2026-11-03", 50], ["2026-11-04", 51]])], [3, new Map([["2026-11-04", 20]])]]);
  const t = reactionTable(reports, { id: 1, name: "Uber" }, [{ id: 3, name: "Lyft" }, { id: 2, name: "DoorDash" }, { id: 9, name: "Bolt" }], closes);
  assert.deepEqual(t.cols.map((c) => [c.date, c.reaction.kind, c.reaction.day]), [["2026-11-04", "day", "2026-11-04"]]);
  assert.deepEqual(t.rows.map((r) => r.co.name), ["Uber", "DoorDash", "Lyft"]);
  assert.ok(Math.abs(t.rows[0].moves[0].pct + 10) < 1e-9 && Math.abs(t.rows[1].moves[0].pct - 2) < 1e-9);
  assert.deepEqual(t.rows[2].moves[0], { missing: "No stored close for 2026-11-03" });
  assert.equal(t.unpriced, 1, "Bolt has no stored prices");
});
