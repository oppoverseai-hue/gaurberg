// One grouping rule for the map, its pagers and filter counts, and the Exposure page (GRF-1, GRF-17).
// fixtures/map-links-2026-11-05.json: every non-rejected link touching a seed company, read from Supabase on 2026-11-05 (after DAT-8).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildNodes, directionOf, groupOf, typeCounts, elsewhere, pageOf, SIDES, TYPE_LABEL } from "../src/lib/graph.ts";
import { buildExposure, KINDS } from "../src/lib/exposure-core.ts";

const { rels } = JSON.parse(fs.readFileSync(new URL("./fixtures/map-links-2026-11-05.json", import.meta.url), "utf8"));
const seeds = [...new Map(rels.flatMap((r) => [r.source, r.target]).filter((c) => c.is_seed && c.ticker).map((c) => [c.id, c])).values()];
const byTicker = (t) => seeds.find((c) => c.ticker === t);
const touching = (id) => rels.filter((r) => r.source.id === id || r.target.id === id);
const names = (ns) => ns.map((n) => n.co.name).sort();

const co = (id) => ({ id, name: `Co ${id}`, ticker: null, is_seed: false, entity_type: null });
const link = (relationship_type, source, target, id = 0) => ({ id, relationship_type, source: co(source), target: co(target), confidence: null, evidence: [] });
const F = 1; // the focal company in the hand-made links

test("direction is read from the stored sentence: target = focal is into, source = focal is out; competes and partners have none", () => {
  for (const t of ["supplies", "sells_to", "invests", "acquires"]) {
    assert.equal(directionOf(link(t, 2, F), F), "in", `${t}: other ${TYPE_LABEL[t]} focal`);
    assert.equal(directionOf(link(t, F, 2), F), "out", `${t}: focal ${TYPE_LABEL[t]} other`);
  }
  for (const t of ["competes", "partners"]) {
    assert.equal(directionOf(link(t, 2, F), F), null);
    assert.equal(directionOf(link(t, F, 2), F), null);
  }
});

test("each company gets one group from all its links together", () => {
  const g = (...ls) => groupOf(ls, F);
  assert.equal(g(link("sells_to", 2, F), link("invests", F, 2)), "both", "Aurora sells to Uber and Uber invests in Aurora");
  assert.equal(g(link("supplies", 2, F), link("supplies", 2, F)), "left");
  assert.equal(g(link("invests", F, 2)), "right");
  assert.equal(g(link("competes", F, 2), link("supplies", 2, F)), "left", "a rival that supplies sits with suppliers");
  assert.equal(g(link("competes", F, 2), link("partners", F, 2)), "bottom", "a rival that partners sits with partners");
  assert.equal(g(link("competes", F, 2), link("competes", 2, F)), "top", "competes both ways is still one competitor");
  assert.equal(g(link("partners", 2, F)), "bottom");
  // Order of links never changes the group (the old rule took the first of two equal sides).
  const ls = [link("invests", F, 2, 1), link("sells_to", 2, F, 2), link("partners", F, 2, 3)];
  assert.equal(groupOf(ls, F), groupOf([...ls].reverse(), F));
});

test("Uber: Competes counts 19 companies; the Competitors group holds 16 and says 3 more are shown in other groups", () => {
  const uber = byTicker("UBER");
  const all = touching(uber.id);
  assert.equal(all.filter((r) => r.relationship_type === "competes").length, 19, "19 competes links");
  assert.equal(typeCounts(all, uber.id).competes, 19, "the Competes pill");
  const nodes = buildNodes(all, uber.id);
  assert.equal(pageOf(nodes, "top", 0).total, 16, "the Competitors pager in the default view");
  const more = elsewhere(nodes, "top");
  assert.deepEqual(names(more), ["Alphabet", "Didi", "Instacart"]);
  assert.deepEqual(more.map((n) => n.side).sort(), ["bottom", "left", "right"].sort(), "Alphabet supplies (into), Didi a stake (out), Instacart a partner");
  // With the Competes filter on, the pager shows the pill's number.
  const comp = buildNodes(all.filter((r) => r.relationship_type === "competes"), uber.id);
  assert.equal(pageOf(comp, "top", 0).total, 19);
});

// The 24 pairs with directed links both into and out of the focal company, from the database on 2026-11-05.
const BOTH = {
  AMD: ["OpenAI"], AUR: ["Uber Technologies"], BYIT: ["Cloud Bridge Technologies"], CBRS: ["G42", "OpenAI"], CRWV: ["NVIDIA", "OpenAI"],
  LCID: ["Uber Technologies"], NBIS: ["Toloka"], NVDA: ["CoreWeave"], PONY: ["Toyota"], TSM: ["SSMC", "VIS", "Xintec"],
  UBER: ["Aurora", "Lucid"], VOD: ["Oak Holdings", "Vantage Towers"],
  WRD: ["Alliance Automotive R&D (Shanghai)", "Guangzhou Yuji", "Nissan", "Ourland Environmental Technical", "Yutong Bus", "Zhengzhou Yutong Heavy Industries"],
};

test("the 24 companies with links both ways each sit once, in Both ways, and nothing else does", () => {
  assert.equal(Object.values(BOTH).flat().length, 24);
  for (const f of seeds) {
    const nodes = buildNodes(touching(f.id), f.id);
    assert.deepEqual(names(nodes.filter((n) => n.side === "both")), [...(BOTH[f.ticker] ?? [])].sort(), f.ticker);
    assert.equal(new Set(nodes.map((n) => n.co.id)).size, nodes.length, `${f.ticker}: one node per company`);
  }
});

test("for every seed company and link type, the pill equals what the pagers add up to with that filter on", () => {
  for (const f of seeds) {
    const all = touching(f.id);
    const pills = typeCounts(all, f.id);
    for (const t of Object.keys(TYPE_LABEL)) {
      const nodes = buildNodes(all.filter((r) => r.relationship_type === t), f.id);
      assert.equal(SIDES.reduce((a, s) => a + pageOf(nodes, s, 0).total, 0), pills[t], `${f.ticker} ${t}`);
    }
    // Default view: Competitors + "more shown in other groups" = Competes pill; the same for Partners.
    const nodes = buildNodes(all, f.id);
    assert.equal(pageOf(nodes, "top", 0).total + elsewhere(nodes, "top").length, pills.competes, `${f.ticker} competes`);
    assert.equal(pageOf(nodes, "bottom", 0).total + elsewhere(nodes, "bottom").length, pills.partners, `${f.ticker} partners`);
    assert.equal(SIDES.reduce((a, s) => a + pageOf(nodes, s, 0).total, 0), nodes.length, `${f.ticker}: every company on one side`);
  }
});

test("Exposure page: one row per company, in the same group as on the map, for every seed company (promoted links)", () => {
  for (const f of seeds) {
    const promoted = touching(f.id).filter((r) => r.status === "promoted");
    const e = buildExposure(f.id, promoted);
    const rows = [...KINDS.flatMap((k) => e.ranked[k]), ...e.unweighted, ...e.partners, ...e.competitors];
    const nodes = buildNodes(promoted, f.id);
    assert.equal(new Set(rows.map((x) => x.co.id)).size, rows.length, `${f.ticker}: no company twice`);
    assert.equal(rows.length, nodes.length, `${f.ticker}: same companies as the map`);
    const side = new Map(nodes.map((n) => [n.co.id, n.side]));
    for (const x of rows) assert.equal(x.place, side.get(x.co.id), `${f.ticker} ${x.co.name}`);
    assert.equal(e.competitors.length, pageOf(nodes, "top", 0).total, `${f.ticker} competitors`);
    assert.equal(e.partners.length, pageOf(nodes, "bottom", 0).total, `${f.ticker} partners`);
    assert.equal(e.alsoCompete, elsewhere(nodes, "top").length, `${f.ticker} competitors elsewhere`);
    assert.equal(rows.reduce((a, x) => a + x.links.length, 0), promoted.filter((r) => r.source.id !== r.target.id).length, `${f.ticker}: every link on a row`);
  }
  const uber = byTicker("UBER");
  const e = buildExposure(uber.id, touching(uber.id));
  const alphabet = [...e.unweighted, ...KINDS.flatMap((k) => e.ranked[k])].find((x) => x.co.name === "Alphabet");
  assert.deepEqual(alphabet.links.map((l) => l.rel.relationship_type).sort(), ["competes", "supplies"], "Alphabet: one row with both links");
  assert.equal(e.competitors.length, 16);
  assert.equal(e.alsoCompete, 3);
});
