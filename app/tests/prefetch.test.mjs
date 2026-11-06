// Prefetching (item 25): links to other companies' pages inside the long lists and side panels on Who is exposed, the Ecosystem map
// and the Earnings calendar are prefetch={false}; the tab bar and breadcrumb keep the default prefetch.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (p) => fs.readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
const companyLinks = (src) => [...src.matchAll(/<Link\b[^>]*href=\{?[`"]\/company\/[^>]*>/g)].map((m) => m[0]);

for (const file of ["components/ExposureMatrix.tsx", "components/MapView.tsx", "app/calendar/CalendarView.tsx"]) {
  test(`${file}: every link to a company page is prefetch={false}`, () => {
    const src = read(file);
    const links = companyLinks(src).concat([...src.matchAll(/<Link\b[^>]*href=\{picked\.href\}[^>]*>/g)].map((m) => m[0]));
    assert.ok(links.length > 0, "found the links");
    for (const l of links) assert.match(l, /prefetch=\{false\}/, l);
  });
}

test("the tab bar and breadcrumb keep the default prefetch", () => {
  for (const file of ["components/CompanyTabs.tsx", "components/Breadcrumbs.tsx"]) assert.doesNotMatch(read(file), /prefetch=/, file);
});
