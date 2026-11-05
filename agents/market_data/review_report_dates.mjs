// Review table for staged SEC report dates (GRF-20). Reads runs/m52/report_dates.json from load_report_dates.py and a JSON list of
// New York trading days (dates with stored closes), applies the same reaction-day rule as the app (app/src/lib/reaction-core.ts)
// and writes runs/m52/review.md. Read-only: writes no database row.
// Usage: node agents/market_data/review_report_dates.mjs runs/m52 <trading-days.json>
import fs from "node:fs";
import path from "node:path";
import { reactionDay, nyParts } from "../../app/src/lib/reaction-core.ts";

const [dir, daysFile] = process.argv.slice(2);
const rep = JSON.parse(fs.readFileSync(path.join(dir, "report_dates.json"), "utf8"));
const days = JSON.parse(fs.readFileSync(daysFile, "utf8"));
const cell = (s) => String(s ?? "").replace(/\|/g, "\\|");
const L = [`# Staged SEC report dates for review (GRF-20)`, ``,
  `Loaded by \`agents/market_data/load_report_dates.py\` for New York dates before ${rep.today}: the last ${rep.keep} 8-K item 2.02 filings per US-primary seed company whose press release (exhibit 99) names the quarter. Nothing here is promoted.`,
  `Rule column: the app's reaction-day rule on the stored trading days (${days[0]} to ${days.at(-1)}).`, ``,
  `| Company | Quarter (as named) | Report date | Accepted (ET / UTC) | Rule applied | Filing |`, `| --- | --- | --- | --- | --- | --- |`];
const skipped = [], notes = [];
let kept = 0;
for (const [t, c] of Object.entries(rep.companies)) {
  for (const f of c.kept) {
    kept++;
    const r = reactionDay(f.accepted_utc, days);
    const rule = r.kind === "day" ? `${f.timing}: ${r.day} vs ${r.prev}` : `${f.timing}: flagged (${r.reason})`;
    L.push(`| ${t} | ${cell(f.quarter)} ("${cell(f.named_as)}") | ${f.date} | ${nyParts(f.accepted_utc).time} ET / ${f.accepted_utc.slice(11, 16)} UTC | ${cell(rule)} | [8-K](${f.filing}) · [release](${f.release}) |`);
  }
  for (const s of c.skipped) skipped.push(`| ${t} | ${s.date} | ${cell(s.reason)} | [8-K](${s.filing}) |`);
  if (c.note) notes.push(`| ${t} | ${cell(c.note)} |`);
}
L.push(``, `${kept} report dates staged.`, ``, `## Skipped filings (${skipped.length})`, ``, `| Company | Date | Reason | Filing |`, `| --- | --- | --- | --- |`, ...skipped);
L.push(``, `## Companies with no report dates (${notes.length})`, ``, `| Company | Why |`, `| --- | --- |`, ...notes, ``);
fs.writeFileSync(path.join(dir, "review.md"), L.join("\n"));
console.log(`review.md: ${kept} staged, ${skipped.length} skipped, ${notes.length} companies without dates`);
