// News relevance (TRM-4): a headline counts as company news only when it names the company or its ticker; SEC filings always do.
// fixtures/news-headlines-2026-11-05.json: real Finnhub company-news headlines (week to Nov 5, 2026), reviewed by hand.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { namesFor, namesCompany, splitNews } from "../src/lib/news-core.ts";

const { headlines } = JSON.parse(fs.readFileSync(new URL("./fixtures/news-headlines-2026-11-05.json", import.meta.url), "utf8"));
const COS = {
  UBER: { name: "Uber Technologies", ticker: "UBER", aliases: [] }, NET: { name: "Cloudflare", ticker: "NET", aliases: [] },
  GRAB: { name: "Grab", ticker: "GRAB", aliases: [] }, LIME: { name: "Lime", ticker: "LIME", aliases: [] },
  AAPL: { name: "Apple", ticker: "AAPL", aliases: [] }, META: { name: "Meta Platforms", ticker: "META", aliases: ["Facebook", "Meta"] },
};
// Indexes of the fixture headlines that name the company (reviewed by hand on Nov 5).
const NAMED = {
  UBER: [1, 2, 3, 4, 5, 6, 7, 8, 9], NET: [0, 1, 4, 5, 7, 9, 11], GRAB: [0, 3, 4, 6, 9, 10, 11],
  LIME: [0, 1, 6], AAPL: [0, 1, 2, 5, 6, 7, 8, 10, 11], META: [1, 5, 7, 8, 11],
};

test("each real headline is filed as company news exactly when it names the company or its ticker", () => {
  for (const [t, hs] of Object.entries(headlines)) {
    const got = hs.map((h, i) => (namesCompany(h, COS[t]) ? i : -1)).filter((i) => i >= 0);
    assert.deepEqual(got, NAMED[t], t);
  }
});

test("names: the company's name and aliases, each also without one legal ending", () => {
  assert.deepEqual(namesFor(COS.UBER), ["Uber Technologies", "Uber"]);
  assert.deepEqual(namesFor({ name: "Bytes Technology Group", ticker: "BYIT" }), ["Bytes Technology Group", "Bytes Technology"]);
  assert.deepEqual(namesFor({ name: "Nebius Group", ticker: "NBIS" }), ["Nebius Group", "Nebius"]);
  assert.deepEqual(namesFor({ name: "Lime", ticker: "LIME", aliases: ["Neutron Holdings"] }), ["Lime", "Neutron Holdings", "Neutron"]);
});

test("the ticker counts only in capitals and as a whole token; the name in any case as a whole word", () => {
  const net = COS.NET;
  assert.equal(namesCompany("Cloudflare (NET) Could Be 49% Overvalued", net), true);
  assert.equal(namesCompany("Why $NET jumped", net), true);
  assert.equal(namesCompany("Stocks with the best net income growth", net), false, "lower-case word is not the ticker");
  assert.equal(namesCompany("Netskope shares trade lower", net), false, "ticker inside another word");
  assert.equal(namesCompany("Neutron Holdings (NASDAQ:LIME) Falls", COS.LIME), true);
  assert.equal(namesCompany("Uber's quarter in five charts", COS.UBER), true, "possessive");
  assert.equal(namesCompany("UBER-like apps", COS.UBER), true);
  assert.equal(namesCompany("Subercaseaux names new CEO", COS.UBER), false);
});

test("with the proposed alias, Lime's Neutron Holdings headlines count as Lime news (runs/m51/lime_alias.sql)", () => {
  const lime = { ...COS.LIME, aliases: ["Neutron Holdings"] };
  assert.equal(headlines.LIME.filter((h) => namesCompany(h, lime)).length, headlines.LIME.length);
});

test("split keeps order, never drops an item, and SEC filings always count as company news", () => {
  const items = [
    { kind: "news", headline: "3 Stocks to Watch Heading Into Wednesday" },
    { kind: "filing", headline: "8-K: Current report (results of operations)" },
    { kind: "press", headline: "Uber Announces Results for Third Quarter 2026" },
    { kind: "news", headline: "Why DoorDash Is Betting $17 Billion on Instacart" },
  ];
  const { company, market } = splitNews(items, COS.UBER);
  assert.deepEqual(company.map((i) => i.kind), ["filing", "press"]);
  assert.deepEqual(market.map((i) => i.headline), [items[0].headline, items[3].headline]);
  assert.equal(company.length + market.length, items.length);
});
