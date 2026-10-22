# Gaurberg demo kit (DEM-4 to DEM-8) - DRAFT for admin review

Numbers below were read from the database on Thu 22 Oct 2026, 13:40 Makassar. Re-check them before the dry run.

## 1. Three-minute script

Run it in offline mode on the laptop (see offline-demo.md), with the hosted app open in a second tab as backup.

| Time | Screen | Say | Proof on screen |
| --- | --- | --- | --- |
| 0:00-0:20 | Home | "Gaurberg shows which companies move a stock's price: suppliers, customers, partners, rivals. Every link comes from a source, and every link shows how far it has been checked." | 25 mapped companies, 292 companies in the graph |
| 0:20-1:10 | Map for Uber | "Uber's links are on one screen. Click Uber-Aurora: the quote is from the filing, with the filing date and a link." | Link panel: trust badge, quote word for word, latest headline per company |
| 1:10-1:50 | Company page, Uber | "Same page a trader would use: price chart, key numbers, margins, news, insider buys and sells." | Chart periods, filing note on revenue growth and margins, news, insiders |
| 1:50-2:30 | Search for a small company, live lookup | "If a company is not mapped, the agent reads its latest filing and builds links on the spot. They are labelled live, not reviewed." | Lightning badge "Live-generated, not reviewed" |
| 2:30-3:00 | Under the hood | "I tested the extraction agent. This page shows every test, including the ones that failed." | /hood: requirements, tests, model cost, sources share |

Fallback if the network fails: skip the live lookup step and say it needs the network. The rest runs from saved data.

## 2. One-pager: what is in, what was cut

In and working:
- Ecosystem map with six link types: supplies, sells to, partners, competes, invests in, acquired.
- 379 reviewed links (all checked by the admin, each with a source quote) plus 37 live-generated links, shown with a different badge.
- Company page: price chart, key numbers, news, insider trades, offline fallback to saved data.
- Live lookup for any US filer, with cost logged per call.
- Under the hood page, admin page (allowlist, spend), screener.

Cut or incomplete (say so before being asked):
- Holders and 13F data (SMX-1, SMX-2, SMX-4): too large for the 72 hours.
- Several extraction model-comparison tests still show as failed on /hood. They are shown, not hidden.
- Saved price history covers 10 companies; the rest need a live connection.
- Two live-lookup queue rows (IEAG) were run but not loaded. Lime has no 10-K.
- The news feed from Finnhub is only checked on the hosted app, not in offline mode.

## 3. Answers sheet (likely questions)

**Why not just use Bloomberg or a data vendor?** The point is the link and its evidence, not the price. Each link has a quote and a source, and an unreviewed link is labelled as such.

**How do you know the links are right?** The admin reviewed every promoted link. Quotes are checked word for word against the filing text (the "quote found" flag). Test results are on /hood.

**What does it cost to run?** 46 logged model runs cost USD 19.58 in total across the build. Live lookup cost per call is in the admin page.

**What did the agent get wrong?** Early live lookups returned auditors, law firms and underwriters as relationships; I added rules to skip them (live-lookup v7). A Uber insider "sale" was actually Uber filing as an owner of another company; fixed with an issuer check.

**Why SEC filings?** They are public, dated and quotable. News is a second source, not the base.

**Could this work for Deriv?** (Admin to write in his own words. Suggested point: the same graph could show which counterparties and suppliers sit behind a traded name.)

**What would you build next?** Holders and 13F, a larger company set, automated tests and monitoring (DEM-10).

## 4. Recorded walkthrough (DEM-6)
Record the script above once, offline mode, screen plus voice, under 3 minutes. Needs the admin's laptop. Save as a file and keep a copy on the phone.

## 5. Dry run (DEM-7) and outside viewer (DEM-9)
Thursday evening, laptop and the network that will be used: run the script start to finish with a timer, then once with the network off. Log time, anything that broke, and fixes in Start Here.
Outside viewer, Thursday 10 pm: the viewer opens the hosted link, tries the map and one company page without help. Log their reaction word for word.
