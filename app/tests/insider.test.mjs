// Insider trades from Form 4 (SMX-3, NFR-1), tested on real filings downloaded from SEC EDGAR on 2026-11-04:
// fixtures/form4-uber-sells-aur.xml       Uber (10% owner) sells 29,369,611 Aurora shares at $6.205 on 2026-09-15 (filed in Uber's list)
// fixtures/form4-uber-officer-exercise.xml an Uber officer's option exercises (M) and tax withholding (F): no open-market trade
// Run: npm test   (node's built-in runner; needs Node 22.6+ for the .ts import)
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseForm4, pickFilings, filingUrl } from "../src/lib/insider-core.ts";

const read = (f) => fs.readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8");
const SALE = read("form4-uber-sells-aur.xml"), EXERCISE = read("form4-uber-officer-exercise.xml");
const UBER = "0001543151", AUR = "1828108";

test("a sale is an insider trade in the issuer (Aurora), never in the seller (Uber)", () => {
  assert.deepEqual(parseForm4(SALE, UBER, "2026-09-17", "u"), []);
  const t = parseForm4(SALE, AUR, "2026-09-17", "u");
  assert.equal(t.length, 1);
  assert.deepEqual(t[0], { insider: "Uber Technologies, Inc", role: "10% owner", side: "Sell", shares: 29369611, price: 6.205, date: "2026-09-15", filed: "2026-09-17", url: "u", line: 1 });
});

test("option exercises and tax withholding are not open-market trades", () => {
  assert.deepEqual(parseForm4(EXERCISE, UBER, "2026-10-20", "u"), []);
});

test("filings are picked by form, age and count; URLs use the CIK without zeros", () => {
  const now = Date.parse("2026-11-04T00:00:00Z");
  const r = { form: ["4", "8-K", "4", "4", "4"], filingDate: ["2026-11-01", "2026-11-01", "2026-09-01", "2026-07-01", "2026-10-30"],
    accessionNumber: ["0001-26-1", "x", "0001-26-2", "0001-26-3", "0001-26-4"], primaryDocument: ["xslF345X06/a.xml", "b", "c.xml", "d.xml", "e.xml"] };
  const p = pickFilings(r, now);
  assert.deepEqual(p.map((x) => x.acc), ["0001261", "0001262", "0001264"], "the July filing is older than 90 days");
  assert.equal(p[0].file, "a.xml", "the stylesheet folder is dropped to get the raw XML");
  assert.equal(pickFilings(r, now, 90, 2).length, 2);
  assert.equal(filingUrl(UBER, p[0]), "https://www.sec.gov/Archives/edgar/data/1543151/0001261/a.xml");
});
