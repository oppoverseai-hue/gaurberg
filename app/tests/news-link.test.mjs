// News links (TRM-7): the data service's redirect links go through our route; everything else opens as is.
import { test } from "node:test";
import assert from "node:assert/strict";
import { isFinnhubNewsUrl, newsHref, fallbackSearchUrl } from "../src/lib/news-link.ts";

const fh = "https://finnhub.io/api/news?id=abc123-DEF";
test("only the data service's news address is rewritten", () => {
  assert.equal(isFinnhubNewsUrl(fh), true);
  for (const u of ["https://finnhub.io/api/news?id=x&y=1", "http://finnhub.io/api/news?id=x", "https://evil.example/https://finnhub.io/api/news?id=x", "https://www.sec.gov/Archives/x.htm", ""]) assert.equal(isFinnhubNewsUrl(u), false, u);
});
test("a data-service link becomes our route with the original address, headline and source", () => {
  const h = newsHref(fh, "DoorDash to acquire Instacart in $17 billion deal", "Yahoo");
  assert.ok(h.startsWith("/api/news-go?"));
  const q = new URL(h, "http://x").searchParams;
  assert.equal(q.get("u"), fh); assert.equal(q.get("s"), "Yahoo"); assert.match(q.get("h"), /Instacart/);
});
test("SEC and other links are untouched", () => {
  const sec = "https://www.sec.gov/Archives/edgar/data/1/2/x.htm";
  assert.equal(newsHref(sec, "8-K", "SEC EDGAR"), sec);
});
test("the fallback is a web search for the headline and source, capped in length", () => {
  const u = fallbackSearchUrl("DoorDash to acquire Instacart", "Yahoo");
  assert.ok(u.startsWith("https://www.google.com/search?q=")); assert.match(decodeURIComponent(u), /Instacart Yahoo/);
  assert.ok(decodeURIComponent(new URL(fallbackSearchUrl("a".repeat(500), "s")).searchParams.get("q")).length <= 200);
});
