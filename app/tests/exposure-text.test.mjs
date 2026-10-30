// Wording helpers for the Exposure page (GRF-17), on real promoted rows where they matter.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildExposure } from "../src/lib/exposure-core.ts";
import { monthYear, relationText, summaryLine } from "../src/lib/exposure-text.ts";

const rels = JSON.parse(fs.readFileSync(new URL("./fixtures/exposure-rows.json", import.meta.url), "utf8")).rels;
const MSFT = 5;

test("as-of dates read month and year; a date we cannot read gives null, never a guess", () => {
  assert.equal(monthYear("2025-12-31"), "Dec 2025");
  assert.equal(monthYear("2026-01-01"), "Jan 2026");
  assert.equal(monthYear(null), null);
  assert.equal(monthYear("2025"), null);
  assert.equal(monthYear("2025-13-01"), null);
});

test("relationship wording follows the link's direction", () => {
  const co = (id) => ({ id, name: `Co ${id}`, ticker: null, is_seed: false, entity_type: null });
  const says = (relationship_type, source, target) => relationText({ relationship_type, source: co(source), target: co(target) }, 1, "Uber");
  assert.equal(says("supplies", 2, 1), "Supplies Uber");
  assert.equal(says("supplies", 1, 2), "Buys from Uber");
  assert.equal(says("sells_to", 2, 1), "Sells to Uber");
  assert.equal(says("sells_to", 1, 2), "Buys from Uber");
  assert.equal(says("invests", 2, 1), "Holds a stake in Uber");
  assert.equal(says("invests", 1, 2), "Uber holds a stake");
  assert.equal(says("acquires", 1, 2), "Acquired by Uber");
  assert.equal(says("acquires", 2, 1), "Acquired Uber");
  assert.equal(says("partners", 2, 1), "Partner of Uber");
  assert.equal(says("competes", 1, 2), "Competes with Uber");
});

test("summary line shows only counts that exist and adds up to the group headers", () => {
  const e = buildExposure(MSFT, rels.filter((r) => r.source.id === MSFT || r.target.id === MSFT));
  const line = summaryLine(e);
  assert.match(line, /^\d+ linked compan(y|ies)/);
  const n = (re) => Number(re.exec(line)?.[1] ?? 0);
  const ranked = Object.values(e.ranked).flat().length;
  assert.equal(n(/(\d+) states? a share/), ranked);
  assert.equal(n(/(\d+) gives? no size/), e.unweighted.length);
  assert.equal(n(/(\d+) partners?/), e.partners.length);
  assert.equal(n(/(\d+) competitors?/), e.competitors.length);
  assert.equal(summaryLine(buildExposure(MSFT, [])), null);
  const only = buildExposure(MSFT, rels.filter((r) => r.relationship_type === "competes" && r.source.id === MSFT).slice(0, 1));
  assert.equal(summaryLine(only), "1 linked company: 1 competitor");
});
