// Paging rules for the ecosystem map: more than 5 companies on a side are shown 5 at a time.
import { test } from "node:test";
import assert from "node:assert/strict";
import { pageOf, MAX_PER_SIDE } from "../src/lib/graph.ts";

const node = (id, side) => ({ co: { id, name: `Co ${id}`, ticker: null, is_seed: false, entity_type: null }, side, links: [], score: 100 - id });
const nodes = [...Array.from({ length: 19 }, (_, i) => node(i + 1, "top")), node(100, "left"), node(101, "left")];

test("19 competitors page as 5/5/5/4", () => {
  const sizes = [0, 1, 2, 3].map((p) => pageOf(nodes, "top", p).visible.length);
  assert.deepEqual(sizes, [5, 5, 5, 4]);
  const g = pageOf(nodes, "top", 0);
  assert.equal(g.pages, 4); assert.equal(g.total, 19); assert.equal(g.from, 1); assert.equal(g.to, 5);
  const last = pageOf(nodes, "top", 3);
  assert.equal(last.from, 16); assert.equal(last.to, 19);
});
test("pages are clamped, so a stale page after a filter change still shows a real batch", () => {
  assert.equal(pageOf(nodes, "top", 99).page, 3);
  assert.equal(pageOf(nodes, "top", -2).page, 0);
  assert.equal(pageOf(nodes, "top", NaN).page, 0);
});
test("a side with 5 or fewer needs one page; an empty side is 0 of 0", () => {
  const l = pageOf(nodes, "left", 0);
  assert.equal(l.pages, 1); assert.equal(l.visible.length, 2);
  const e = pageOf(nodes, "bottom", 0);
  assert.equal(e.total, 0); assert.equal(e.from, 0); assert.equal(e.to, 0); assert.equal(e.visible.length, 0);
});
test("every company appears on exactly one page", () => {
  const ids = [0, 1, 2, 3].flatMap((p) => pageOf(nodes, "top", p).visible.map((n) => n.co.id));
  assert.equal(new Set(ids).size, 19); assert.equal(MAX_PER_SIDE, 5);
});
