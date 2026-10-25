// Exposure view rules (GRF-17 on GRF-11), tested on real promoted rows.
// fixtures/exposure-rows.json: promoted links touching UBER, MSFT, NVDA, CRWV, VOD, TPG Telecom and BYIT, read from Supabase on 2026-10-25.
// Links 69, 317, 370 and 630 come from data/snapshot.json (saved promoted links).
// Run: npm test   (node's built-in runner; needs Node 22.6+ for the .ts import)
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildExposure, figureInQuote, exposureWeight, realWeight, KINDS, NOT_DISCLOSED, NO_SIZE, NOT_IN_QUOTE } from "../src/lib/exposure-core.ts";

const rels = JSON.parse(fs.readFileSync(new URL("./fixtures/exposure-rows.json", import.meta.url), "utf8")).rels;
const snap = JSON.parse(fs.readFileSync(new URL("../data/snapshot.json", import.meta.url), "utf8"));
const coById = new Map(snap.companies.map((c) => [c.id, c]));
const snapRel = (id) => { const { source_id, target_id, ...r } = snap.rels.find((x) => x.id === id); return { ...r, source: coById.get(source_id), target: coById.get(target_id) }; };

const ID = { UBER: 1, MSFT: 5, NVDA: 8, CRWV: 17, VOD: 316, TPG: 336, BYIT: 395, WRD: 424 };
const touching = (id) => rels.filter((r) => r.source.id === id || r.target.id === id);
const exp = (id) => buildExposure(id, touching(id));
const allRows = (e) => [...KINDS.flatMap((k) => e.ranked[k]), ...e.unweighted, ...e.partners, ...e.competitors];
const names = (rows) => rows.map((x) => x.co.name);

test("figure check ignores trailing zeros on both sides and reads wholly-owned as 100%", () => {
  assert.ok(figureInQuote(6.5, ["BlackRock, Inc. 1,743,626,604 Shareholding1 17.005026% 6.50% 3.0004%"]));
  assert.ok(figureInQuote(51, ["each holding 51.0% and 49.0% of its equity interest"]));
  assert.ok(figureInQuote(86, ["our controlling stake in Trendyol GO was 86 %."]));
  assert.ok(figureInQuote(100, ["an independently managed, wholly-owned subsidiary"]));
  assert.ok(figureInQuote(100, ["a wholly‑owned subsidiary"]));
  assert.ok(figureInQuote(100, ["the Company acquired all of the outstanding shares of Kivera"]));
  assert.ok(!figureInQuote(50, ["a wholly-owned subsidiary"]), "wholly-owned states 100%, nothing else");
  assert.ok(!figureInQuote(4, ['an investment by the Company in Corintis SA ("Corintis") in exchange for Series A1 preferred shares.']));
  assert.ok(!figureInQuote(944, ["Emirates Telecommunications Group Company PJSC 3,944,743,685"]), "share counts are read whole");
});

test("Microsoft is hit: CoreWeave ranks at 67% of its own revenue; Bytes' 68% of GII is context only", () => {
  const e = exp(ID.MSFT);
  assert.deepEqual(names(e.ranked.source_revenue), ["CoreWeave"]);
  const cw = e.ranked.source_revenue[0];
  assert.equal(cw.weight, 67);
  assert.equal(cw.text, "Microsoft is about 67% of CoreWeave's revenue (fiscal 2025)");
  assert.equal(cw.kindLabel, "Seller's revenue");
  assert.equal(e.ranked.target_cost.length + e.ranked.ownership.length, 0);
  const bytes = e.unweighted.find((x) => x.co.ticker === "BYIT");
  assert.equal(bytes.text, NOT_DISCLOSED);
  assert.equal(bytes.weight, null);
  assert.equal(bytes.context.length, 1, "only the GII quote, not the emissions quote");
  assert.match(bytes.context[0].quote.quote, /68% of the Group’s GII/);
  assert.equal(bytes.context[0].text, "Stated in the source, not a stored weight");
  assert.ok(!e.empty);
});

test("CoreWeave is hit: the 67% is CoreWeave's share, so Microsoft reads Size not disclosed with the figure as context", () => {
  const e = exp(ID.CRWV);
  const ms = allRows(e).filter((x) => x.rel.id === 37);
  assert.equal(ms.length, 1);
  assert.equal(ms[0].weight, null);
  assert.equal(ms[0].text, NOT_DISCLOSED);
  assert.equal(ms[0].kindLabel, "Seller's revenue");
  assert.equal(ms[0].context[0].text, "Microsoft is about 67% of CoreWeave's revenue (fiscal 2025). This is CoreWeave's share, not Microsoft's.");
  assert.ok(KINDS.every((k) => e.ranked[k].every((x) => x.co.ticker !== "MSFT")));
});

test("Vodafone is hit: holders e&, BlackRock and Norges Bank rank by their own stake; Vodafone's own holdings are context", () => {
  const e = exp(ID.VOD);
  assert.deepEqual(e.ranked.ownership.map((x) => [x.co.name, x.weight]), [["e&", 17.005026], ["BlackRock", 6.5], ["Norges Bank", 3.0004]]);
  assert.equal(e.ranked.ownership[1].text, "BlackRock holds 6.5% of Vodafone Group (as of 2026-03-31)");
  const ziggo = e.unweighted.find((x) => x.co.name === "VodafoneZiggo");
  assert.equal(ziggo.text, NOT_DISCLOSED);
  assert.match(ziggo.context[0].text, /^Vodafone Group holds 50% of VodafoneZiggo \(as of 2026-03-31\)\. This is Vodafone Group's share, not VodafoneZiggo's\.$/);
  assert.ok(e.partners.length > 0 && e.partners.every((x) => x.text === NO_SIZE && x.kindLabel === "None"));
});

test("TPG Telecom is hit (no company page): Vodafone ranks at its own 23.7% holding", () => {
  const e = exp(ID.TPG);
  assert.deepEqual(e.ranked.ownership.map((x) => [x.co.name, x.weight, x.text]), [["Vodafone Group", 23.7, "Vodafone Group holds 23.7% of TPG Telecom (as of 2026-03-31)"]]);
});

test("Uber is hit: its own stakes (Trendyol GO 86%, WeRide 5.6%) are context; WeRide hit ranks Uber at 5.6%", () => {
  const e = exp(ID.UBER);
  assert.ok(KINDS.every((k) => e.ranked[k].length === 0), "nobody's own share is stated against Uber");
  const ty = e.unweighted.find((x) => x.co.name === "Trendyol GO");
  assert.match(ty.context[0].text, /^Uber Technologies holds 86% of Trendyol GO .*This is Uber Technologies's share, not Trendyol GO's\.$/);
  const w = buildExposure(ID.WRD, rels.filter((r) => r.id === 571));
  assert.deepEqual(w.ranked.ownership.map((x) => [x.co.ticker, x.weight]), [["UBER", 5.6]]);
});

test("NVIDIA is hit: no stated figures, so nothing ranks and every directed link reads Size not disclosed", () => {
  const e = exp(ID.NVDA);
  assert.ok(KINDS.every((k) => e.ranked[k].length === 0));
  assert.ok(e.unweighted.length > 0 && e.unweighted.every((x) => x.text === NOT_DISCLOSED && x.kindLabel));
  assert.ok(!e.empty);
});

test("competitors are never exposure, and every ranked weight is the stored, quoted figure (no back-fill)", () => {
  for (const [t, id] of Object.entries(ID)) {
    const e = exp(id);
    for (const x of e.competitors) assert.ok(x.weight == null && x.text === NO_SIZE && x.rel.relationship_type === "competes", t);
    assert.ok(!e.unweighted.some((x) => x.rel.relationship_type === "competes"), t);
    for (const k of KINDS) for (const x of e.ranked[k]) {
      assert.equal(x.weight, x.rel.exposure_pct, `${t} ${x.co.name}`);
      assert.equal(x.kind, k);
      assert.ok(figureInQuote(x.weight, x.rel.evidence.map((v) => v.quote)), `${t} ${x.co.name}`);
      assert.equal(exposureWeight(x.rel, id), x.weight);
    }
    for (const x of allRows(e)) assert.ok(x.kindLabel, `${t} ${x.co.name} shows its kind`);
    for (const k of KINDS) for (let i = 1; i < e.ranked[k].length; i++) assert.ok(e.ranked[k][i - 1].weight >= e.ranked[k][i].weight);
  }
});

test("a stored figure missing from its quote is unranked and flagged (links 317, 630)", () => {
  for (const id of [317, 630]) {
    const r = snapRel(id);
    const e = buildExposure(r.target.id, [r]);
    assert.ok(KINDS.every((k) => e.ranked[k].length === 0), `link ${id}`);
    assert.equal(e.unweighted[0].flag, NOT_IN_QUOTE);
    assert.equal(e.unweighted[0].text, NOT_DISCLOSED);
    assert.equal(realWeight(r), null, `link ${id} must not thicken a map line`);
  }
});

test("wholly-owned and 'all of the outstanding shares' count as a stated 100% (links 69, 370)", () => {
  for (const id of [69, 370]) {
    const r = snapRel(id);
    const e = buildExposure(r.target.id, [r]);
    assert.deepEqual(e.ranked.ownership.map((x) => [x.co.name, x.weight]), [[r.source.name, 100]], `link ${id}`);
  }
});

test("empty state: no links, or competitors only", () => {
  assert.ok(buildExposure(ID.MSFT, []).empty);
  const comp = rels.filter((r) => r.relationship_type === "competes" && (r.source.id === ID.MSFT || r.target.id === ID.MSFT));
  if (comp.length) assert.ok(buildExposure(ID.MSFT, comp).empty);
});
