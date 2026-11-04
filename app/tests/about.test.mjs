// One segment taxonomy (UX-4): the About segment is the header segment for every seed company, and Finnhub's industry is only ever
// its own "Industry (Finnhub)" row. fixtures/seed-companies-2026-11-05.json: the 34 seed companies read from Supabase on 2026-11-05;
// industries are the saved Finnhub profiles in data/market/*.json (US listings only).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { aboutRows, segmentLabel, SEGMENT, INDUSTRY } from "../src/lib/about-core.ts";

const { companies } = JSON.parse(fs.readFileSync(new URL("./fixtures/seed-companies-2026-11-05.json", import.meta.url), "utf8"));
const profile = (t) => {
  const f = new URL(`../data/market/${t}.json`, import.meta.url);
  return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, "utf8")).profile ?? null) : null;
};
const row = (rows, label) => rows.find(([k]) => k === label);

test("for every seed company, About's Segment equals the header segment, and only companies.segment is used", () => {
  assert.equal(companies.length, 34);
  for (const c of companies) {
    const p = profile(c.ticker);
    const rows = aboutRows(c, p);
    const header = segmentLabel(c.segment); // what the page header shows
    assert.ok(header, `${c.ticker} has a segment`);
    assert.equal(row(rows, SEGMENT)[1], header, c.ticker);
    assert.ok(!rows.some(([k]) => k === "Sector"), `${c.ticker}: no "Sector" row`);
    if (p?.industry) assert.notEqual(row(rows, SEGMENT)[1], p.industry, `${c.ticker}: Finnhub's industry is never the segment`);
  }
});

test("Finnhub's industry is its own row, and the row is left out when Finnhub has none", () => {
  const uber = companies.find((c) => c.ticker === "UBER");
  const rows = aboutRows(uber, profile("UBER"));
  assert.deepEqual(row(rows, SEGMENT), [SEGMENT, "Consumer"]);
  assert.deepEqual(row(rows, INDUSTRY), [INDUSTRY, "Road & Rail"]);
  for (const t of ["VOD", "AML", "0992"]) {
    const rows2 = aboutRows(companies.find((c) => c.ticker === t), profile(t));
    assert.equal(row(rows2, INDUSTRY), undefined, `${t}: no Finnhub value, no row`);
  }
  assert.equal(row(aboutRows({ segment: "business", size_tier: null }, { industry: "" }), INDUSTRY), undefined, "an empty value is no value");
  assert.equal(row(aboutRows({ segment: null, size_tier: null }, { industry: "Technology" }), SEGMENT)[1], null, "no segment reads Not available, never the industry");
});
