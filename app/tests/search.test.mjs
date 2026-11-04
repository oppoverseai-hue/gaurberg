// Search over every company (TRM-1). Real companies and links from data/snapshot.json (saved Oct 22, 2026; it has no aliases),
// plus small made-up rows where a rule needs them (aliases, accents, a company with nowhere to open).
// Run: npm test   (node's built-in runner; needs Node 22.6+ for the .ts import)
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildIndex, search, pick, top, norm } from "../src/lib/search-core.ts";

const snap = JSON.parse(fs.readFileSync(new URL("../data/snapshot.json", import.meta.url), "utf8"));
const links = snap.rels.filter((r) => r.status === "promoted").map((r) => ({ source_id: r.source_id, target_id: r.target_id }));
const index = buildIndex(snap.companies, links);
const first = (q) => search(index, q)[0];

test("mapped companies match by ticker and name, and open their page", () => {
  const u = first("uber");
  assert.equal(u.ticker, "UBER");
  assert.equal(u.mapped, true);
  assert.equal(u.href, "/company/UBER");
  assert.equal(u.mapHref, "/company/UBER/map");
  assert.equal(first("LYFT").name, "Lyft");
});

test("a counterparty with no ticker is found and opens the map it sits on, with its panel open", () => {
  const b = first("bolt");
  assert.equal(b.name, "Bolt");
  assert.equal(b.ticker, null);
  assert.equal(b.mapped, false);
  assert.ok(b.context, "Bolt is linked to a mapped company");
  assert.equal(b.href, `/company/${b.context.ticker}/map?focus=${b.id}`);
  assert.ok(index.filter((e) => !e.ticker).length > 300, "most of the graph has no ticker");
});

test("groups are never suggested", () => {
  for (const q of ["riders", "couriers", "mobility drivers"]) assert.ok(!search(index, q).some((h) => /^(Riders|Couriers|Mobility Drivers)$/.test(h.name)), q);
});

test("aliases, suffixed tickers, accents and word starts match; one letter does not match everything", () => {
  const cos = [
    { id: 1, ticker: "TSM", name: "Taiwan Semiconductor Manufacturing", is_seed: true, entity_type: "public_company", aliases: ["TSMC"] },
    { id: 2, ticker: "0700.HK", name: "Tencent", is_seed: false, entity_type: "public_company", aliases: ["Tencent Video"] },
    { id: 3, ticker: null, name: "Telenor Børs Holding", is_seed: false, entity_type: "private_company", aliases: [] },
    { id: 4, ticker: null, name: "Orphan Ltd", is_seed: false, entity_type: "private_company", aliases: [] },
    { id: 5, ticker: null, name: "Riders", is_seed: false, entity_type: "segment_group", aliases: [] },
    { id: 6, ticker: "9999.HK", name: "Lone Listed", is_seed: false, entity_type: "public_company", aliases: [] },
  ];
  const ix = buildIndex(cos, [{ source_id: 1, target_id: 2 }, { source_id: 3, target_id: 1 }, { source_id: 5, target_id: 1 }]);
  assert.deepEqual(ix.map((e) => e.id).sort(), [1, 2, 3, 6], "no ticker and no mapped neighbour (4) and groups (5) are left out");
  const t = search(ix, "tsmc")[0];
  assert.equal(t.id, 1); assert.equal(t.alias, "TSMC");
  assert.equal(search(ix, "0700")[0].id, 2, "the code without its suffix matches");
  assert.equal(search(ix, "video")[0].id, 2);
  assert.equal(search(ix, "bors")[0].id, 3, "accents are ignored");
  assert.equal(search(ix, "x").length, 0);
  assert.equal(norm("Oslo Børs"), "oslo bors");
  assert.equal(pick(ix, "tsmc").id, 1);
  assert.equal(search(ix, "0700")[0].href, "/company/TSM/map?focus=2", "unmapped: the map of the mapped company it is linked to");
  assert.equal(search(ix, "lone")[0].href, "/company/9999.HK", "unmapped with a ticker but no mapped neighbour: its own page");
});

test("one letter matches ticker and name starts only; mapped companies rank first within a match, then the better connected", () => {
  const a = search(index, "a", 50);
  assert.ok(a.length > 0 && a.every((h) => (h.ticker ?? "").toLowerCase().startsWith("a") || norm(h.name).startsWith("a")));
  const hits = search(index, "semi", 50);
  for (let i = 1; i < hits.length; i++) {
    const p = hits[i - 1], h = hits[i];
    if (norm(p.name).startsWith("semi") === norm(h.name).startsWith("semi")) assert.ok(Number(p.mapped) >= Number(h.mapped), `${p.name} before ${h.name}`);
  }
});

test("before typing: the best-connected mapped companies; matching 500 rows takes well under 200 ms", () => {
  const t3 = top(index);
  assert.equal(t3.length, 3);
  assert.ok(t3.every((h) => h.mapped));
  const t0 = performance.now();
  for (let i = 0; i < 100; i++) search(index, ["ub", "tencent", "bolt", "semi", "0700"][i % 5]);
  assert.ok((performance.now() - t0) / 100 < 5, "under 5 ms a search");
});
