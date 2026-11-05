// Earnings calendar (TRM-13, UX-4, GRF-20). fixtures/calendar-2026-11-06.json: a read-only export from Supabase on 2026-11-06
// (34 seed companies, 21 promoted Finnhub dates, no staged rows). Staged rows below are test data, not real.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { prepare, applyFilter, rangeCounts, summarize, groupWeeks, weekStart, splitDetail, toCSV, toICS, icsEscape, icsSummary, nyToday, readStagedForAdmin } from "../src/lib/calendar-core.ts";

const fx = JSON.parse(fs.readFileSync(new URL("./fixtures/calendar-2026-11-06.json", import.meta.url), "utf8"));
const isCovered = (c) => (c.markets ?? [])[0] === "US";
const input = (extra = {}) => ({ ...fx, isCovered, ...extra });
const ALL = { range: "all", q: "", timing: "all" };
const co = (id, ticker, name, segment = "consumer") => ({ id, ticker, name, markets: ["US"], segment });
const ev = (company_id, event_date, detail = "Q3 2026, after market close", status = "promoted") => ({ company_id, event_date, detail, status, fetched_at: "2026-11-05T11:00:00Z" });

test("weeks start on Monday: Sunday belongs to the week before, Monday opens a new one", () => {
  assert.equal(weekStart("2026-11-08"), "2026-11-02"); // Sunday
  assert.equal(weekStart("2026-11-09"), "2026-11-09"); // Monday
  assert.equal(weekStart("2026-11-06"), "2026-11-02"); // Friday
  assert.equal(weekStart("2027-01-03"), "2026-12-28"); // across the year end
  const cos = [co(1, "AAA", "Alpha"), co(2, "BBB", "Beta")];
  const { rows } = prepare({ cos, events: [ev(1, "2026-11-08"), ev(2, "2026-11-09")], links: {}, secIds: [], loadedIds: [1, 2], isCovered, today: "2026-11-06" });
  const weeks = groupWeeks(rows);
  assert.deepEqual(weeks.map((w) => [w.start, w.count]), [["2026-11-02", 1], ["2026-11-09", 1]]);
});

test("an empty week is not listed, and each day gets its own sub-group", () => {
  const cos = [co(1, "AAA", "Alpha"), co(2, "BBB", "Beta"), co(3, "CCC", "Gamma")];
  const { rows } = prepare({ cos, events: [ev(1, "2026-11-10"), ev(2, "2026-11-10"), ev(3, "2026-11-24")], links: {}, secIds: [], loadedIds: [1, 2, 3], isCovered, today: "2026-11-06" });
  const weeks = groupWeeks(rows);
  assert.deepEqual(weeks.map((w) => w.start), ["2026-11-09", "2026-11-23"]); // the week of 16 Nov has nothing and is absent
  assert.equal(weeks[0].days.length, 1);
  assert.deepEqual(weeks[0].days[0].rows.map((r) => r.co.ticker), ["AAA", "BBB"]);
  assert.deepEqual(groupWeeks([]), []);
});

test("a date today is shown in every range; yesterday is not", () => {
  const cos = [co(1, "AAA", "Alpha"), co(2, "BBB", "Beta")];
  const { rows } = prepare({ cos, events: [ev(1, "2026-11-06"), ev(2, "2026-11-05")], links: {}, secIds: [], loadedIds: [1, 2], isCovered, today: "2026-11-06" });
  assert.deepEqual(rows.map((r) => r.co.ticker), ["AAA"]);
  for (const range of [30, 60, 90, "all"]) assert.equal(applyFilter(rows, "2026-11-06", { ...ALL, range }).shown.length, 1);
});

test("a staged date change flags its company, is counted, and its date is never shown", () => {
  const cos = [co(1, "AAA", "Alpha"), co(2, "BBB", "Beta"), co(3, "CCC", "Gamma")];
  const p = prepare({
    cos, links: { 1: 5 }, secIds: [1, 2, 3], loadedIds: [1, 2, 3], isCovered, today: "2026-11-06",
    events: [ev(1, "2026-11-12"), ev(1, "2026-11-19", "Q3 2026", "staged"), ev(2, "2026-11-13"), ev(3, "2026-11-20", "Q3 2026", "staged")],
  });
  assert.deepEqual(p.rows.map((r) => [r.co.ticker, r.date, r.underReview]), [["AAA", "2026-11-12", true], ["BBB", "2026-11-13", false]]);
  assert.equal(p.rows[0].links, 5);
  assert.deepEqual(p.noDate.map((x) => [x.co.ticker, x.reason]), [["CCC", "Staged, not reviewed"]]);
  const s = summarize(p.rows, p.staged, "2026-11-06", ALL);
  assert.equal(s.underReview, 2);
  assert.equal(summarize(p.rows, p.staged, "2026-11-06", { ...ALL, q: "alpha" }).underReview, 1);
  assert.equal(summarize(p.rows, p.staged, "2026-11-06", { ...ALL, range: 30, q: "zzz" }).underReview, 0);
});

test("timing comes from the detail in plain words; nothing is guessed", () => {
  assert.deepEqual(splitDetail("Q3 2026, before market open"), { quarter: "Q3 2026", timing: "before" });
  assert.deepEqual(splitDetail("Q3 2026, after market close"), { quarter: "Q3 2026", timing: "after" });
  assert.deepEqual(splitDetail("Q2 2027"), { quarter: "Q2 2027", timing: "none" });
  assert.deepEqual(splitDetail(null), { quarter: null, timing: "none" });
});

test("real data, 6 Nov 2026: counts, filters and the summary come from the rows shown", () => {
  const p = prepare(input());
  assert.equal(p.rows.length, 21);
  const counts = rangeCounts(p.rows, fx.today, { q: "", timing: "all" });
  assert.deepEqual(counts, { 30: 8, 60: 10, 90: 21, all: 21 });
  const f30 = { range: 30, q: "", timing: "all" };
  const { shown, later } = applyFilter(p.rows, fx.today, f30);
  assert.deepEqual(summarize(shown, p.staged, fx.today, f30), { scheduled: 8, before: 1, after: 3, none: 4, underReview: 0 });
  assert.equal(later.length, 13);
  assert.equal(later[0].co.ticker, "ORCL");
  // Search by ticker, name or segment; timing filter.
  assert.deepEqual(applyFilter(p.rows, fx.today, { ...ALL, q: "nvda" }).shown.map((r) => r.co.ticker), ["NVDA"]);
  assert.deepEqual(applyFilter(p.rows, fx.today, { ...ALL, q: "Cerebras" }).shown.map((r) => r.co.ticker), ["CBRS"]);
  assert.equal(applyFilter(p.rows, fx.today, { ...ALL, q: "infrastructure" }).shown.length, 8);
  assert.deepEqual(applyFilter(p.rows, fx.today, { ...ALL, timing: "before" }).shown.map((r) => r.co.ticker), ["BIDU", "TSM"]);
  const none = applyFilter(p.rows, fx.today, { ...ALL, timing: "none" }).shown;
  assert.ok(none.every((r) => r.timing === "none") && none.length === 8);
});

test("real data: every company without a date in 90 days is listed with a reason", () => {
  const p = prepare(input());
  const nd = Object.fromEntries(p.noDate.map((x) => [x.co.ticker, x.reason]));
  assert.deepEqual(Object.keys(nd).sort(), ["AUR", "CART", "DASH", "GRAB", "LIME", "LYFT", "NET"]);
  assert.equal(nd.GRAB, "Finnhub lists no date; files no 8-K item 2.02");
  assert.equal(nd.DASH, "Finnhub lists no date");
  const nc = Object.fromEntries(p.notCovered.map((x) => [x.co.ticker, x.reason]));
  assert.deepEqual(Object.keys(nc).sort(), ["0992", "AML", "BYIT", "CCC", "SCT", "VOD"]);
  assert.match(nc.VOD, /Main listing outside the US \(LSE\)/);
  // Every seed company appears exactly once: on a date (within 90 days), without a date, or not covered.
  const dated = new Set(p.rows.filter((r) => r.date <= "2027-02-04").map((r) => r.co.id));
  assert.equal(dated.size + p.noDate.length + p.notCovered.length, 34);
  const noTicker = prepare({ ...input(), cos: [...fx.cos, { id: 999, ticker: null, name: "Private Co", markets: null, segment: null }] });
  assert.equal(noTicker.notCovered.find((x) => x.co.id === 999).reason, "No ticker");
});

test("CSV escapes quotes, commas and formula-looking cells", () => {
  const rows = [{ co: co(1, "AAA", 'Alpha, "the" Co'), date: "2026-11-10", quarter: "Q3 2026", timing: "after", underReview: true, links: 3, fetched_at: "" },
    { co: co(2, "BBB", "=HYPERLINK(1)"), date: "2026-11-11", quarter: null, timing: "none", underReview: false, links: 0, fetched_at: "" }];
  const csv = toCSV(rows, true).split("\r\n");
  assert.equal(csv[0], "date,ticker,company,segment,quarter,timing,date_under_review,reviewed_links,source");
  assert.equal(csv[1], '2026-11-10,AAA,"Alpha, ""the"" Co",consumer,Q3 2026,After close,yes,3,Finnhub earnings calendar');
  assert.equal(csv[2], "2026-11-11,BBB,'=HYPERLINK(1),consumer,,Time not given,no,0,Finnhub earnings calendar");
  // Anyone but the admin: no review column at all.
  const plain = toCSV(rows).split("\r\n");
  assert.equal(plain[0], "date,ticker,company,segment,quarter,timing,reviewed_links,source");
  assert.equal(plain[1], '2026-11-10,AAA,"Alpha, ""the"" Co",consumer,Q3 2026,After close,3,Finnhub earnings calendar');
});

test("the staged read runs for the admin only; a reviewer never calls it", async () => {
  let calls = 0;
  const read = async () => { calls++; return [{ company_id: 8, event_date: "2026-11-19" }]; };
  for (const role of ["reviewer", "", "anything"]) {
    assert.deepEqual(await readStagedForAdmin(role, read), { shown: false, rows: [] });
  }
  assert.equal(calls, 0, "no staged read for a non-admin");
  assert.deepEqual(await readStagedForAdmin("admin", read), { shown: true, rows: [{ company_id: 8, event_date: "2026-11-19" }] });
  assert.equal(calls, 1, "one staged read for the admin");
  // As the loader does: promoted rows for everyone, staged rows only from the admin-only read.
  const source = [...fx.events, ev(8, "2026-11-19", null, "staged")];
  const view = async (role) => {
    const st = await readStagedForAdmin(role, async () => source.filter((e) => e.status === "staged"));
    return prepare(input({ events: [...source.filter((e) => e.status === "promoted"), ...st.rows] }));
  };
  const reviewer = await view("reviewer");
  assert.ok(reviewer.rows.every((r) => !r.underReview) && reviewer.staged.length === 0);
  const admin = await view("admin");
  assert.deepEqual(admin.rows.filter((r) => r.underReview).map((r) => r.co.ticker), ["NVDA"]);
  assert.equal(admin.staged.length, 1);
});

test("today is the New York date (America/New_York, winter time UTC-5)", () => {
  assert.equal(nyToday("2026-11-05T23:18:00Z"), "2026-11-05");
  assert.equal(nyToday("2026-11-06T04:30:00Z"), "2026-11-05");
  assert.equal(nyToday("2026-11-06T05:30:00Z"), "2026-11-06");
  assert.equal(nyToday("2026-07-01T03:59:00Z"), "2026-06-30"); // summer time, UTC-4
});

test("a report dated today stays in this week for the whole New York day", () => {
  const cos = [co(1, "AAA", "Alpha")];
  const events = [ev(1, "2026-11-05")]; // Thursday
  for (const now of ["2026-11-05T05:00:00Z", "2026-11-05T23:18:00Z", "2026-11-06T04:59:00Z"]) {
    const today = nyToday(now);
    assert.equal(today, "2026-11-05", now);
    const { rows } = prepare({ cos, events, links: {}, secIds: [], loadedIds: [1], isCovered, today });
    const weeks = groupWeeks(applyFilter(rows, today, { range: 30, q: "", timing: "all" }).shown);
    assert.deepEqual(weeks.map((w) => [w.start, w.count]), [["2026-11-02", 1]], now);
  }
  // Once New York reaches 6 Nov, the 5 Nov report is past and no longer listed.
  const next = nyToday("2026-11-06T05:00:00Z");
  const { rows } = prepare({ cos, events, links: {}, secIds: [], loadedIds: [1], isCovered, today: next });
  assert.equal(rows.length, 0);
});

test("iCal: all-day events, stable UID, escaped and folded text, no clock time", () => {
  const p = prepare(input());
  const rows = applyFilter(p.rows, fx.today, { range: 30, q: "", timing: "all" }).shown;
  const ics = toICS(rows, "2026-11-06T09:15:02.123Z");
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n") && ics.endsWith("END:VCALENDAR\r\n"));
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 8);
  assert.match(ics, /UID:CRWV-Q3-2026-earnings@gaurberg\r\n/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261110\r\nDTEND;VALUE=DATE:20261111\r\n/);
  assert.match(ics, /SUMMARY:CoreWeave Q3 2026 earnings \(after close\)\r\n/);
  assert.match(ics, /SUMMARY:Cerebras Systems Q3 2026 earnings \(time not given\)\r\n/);
  assert.match(ics, /DTSTAMP:20261106T091502Z/);
  assert.ok(!/DTSTART:\d{8}T/.test(ics), "no event has a clock time");
  for (const line of ics.split("\r\n")) assert.ok(Buffer.byteLength(line) <= 75, line);
  // The same company and quarter keep their UID when the date moves.
  const moved = toICS([{ ...rows[1], date: "2026-11-11" }], "2026-11-06T00:00:00Z");
  assert.match(moved, /UID:CRWV-Q3-2026-earnings@gaurberg/);
  assert.equal(icsEscape("a,b;c\\d\ne"), "a\\,b\\;c\\\\d\\ne");
  const long = toICS([{ ...rows[0], co: co(1, "LONG", "A very long company name, with commas; and semicolons, that runs well past seventy-five octets ünïcode") }], "2026-11-06T00:00:00Z");
  assert.ok(long.includes("\r\n "), "long lines are folded");
  assert.equal(icsSummary({ ...rows[0], quarter: null, timing: "before" }), "Lucid earnings (before open)");
});

test("nothing on the export says a future date is confirmed, and no estimates are written", () => {
  const p = prepare(input());
  const text = (toCSV(p.rows) + toICS(p.rows, "2026-11-06T00:00:00Z")).replace(/\r\n /g, "").replace(/not company-confirmed until/gi, "");
  assert.doesNotMatch(text, /confirmed|\bEPS\b|consensus|estimate|\bBMO\b|\bAMC\b/i);
});
