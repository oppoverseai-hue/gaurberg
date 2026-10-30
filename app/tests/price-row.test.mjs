// Price stats row (DEM-1): the 52-week position and the currency label.
import { test } from "node:test";
import assert from "node:assert/strict";
import { rangePosition } from "../src/lib/metrics-core.ts";
import { quoteCurrency } from "../src/lib/listing.ts";

test("52-week position needs all three figures and a real range; it never fills a gap", () => {
  assert.equal(rangePosition(50, 0, 100), 0.5);
  assert.equal(rangePosition(100, 50, 150), 0.5);
  assert.equal(rangePosition(10, 50, 150), 0, "below the saved low stays on the bar");
  assert.equal(rangePosition(200, 50, 150), 1, "above the saved high stays on the bar");
  assert.equal(rangePosition(null, 50, 150), null);
  assert.equal(rangePosition(100, null, 150), null);
  assert.equal(rangePosition(100, 50, undefined), null);
  assert.equal(rangePosition(100, 150, 150), null);
  assert.equal(rangePosition(100, 150, 50), null);
  assert.equal(rangePosition(NaN, 50, 150), null);
});

test("currency comes from the listing: USD only for a US-primary listing, otherwise nothing is stated", () => {
  assert.equal(quoteCurrency(["US"]), "USD");
  assert.equal(quoteCurrency(["UK"]), null);
  assert.equal(quoteCurrency(["UK", "US"]), null);
  assert.equal(quoteCurrency(null), null);
});
