# Gaurberg hand-off (Oct 29, 2026)

For a new Claude Code session. Read CLAUDE.md first, then Start Here (links in docs/README.md). This file is a summary; the docs are the source of truth.

## State

- Build is frozen: no new features. Deadline was Wed Oct 28 (dry run and outside viewer).
- main: `1347686` (PR #64 merged). Repo: oppoverseai-hue/gaurberg. App in `app/`.
- Supabase project: `zyxrptpbifafmstoporw`.

## Merged to main

| PR | What | Requirement |
| --- | --- | --- |
| #54 | Connection finder (/connect) | GRF-16 |
| #56 | Peer comps view in the Screener | TRM-12 |
| #58 | Earnings calendar (/calendar) | TRM-13 |
| #59 | Sources page and (i) tooltips | DEM-2 |
| #60 | Live data only for US-primary listings (CCC never shows the Nasdaq listing) | DEM-3, TRM-9 |
| #61, #62 | Comps region: revenue split, else HQ region; HQ added when rows cover under half | TRM-12 |
| #63 | Exposure view "If [company] is hit" and map highlight | GRF-17 |
| #64 | Landing page fixes at phone width (CSS only) | UX-7, TRM-8 |

Earlier: M17 market data (metrics strip, events line), M14 London and M15 Hong Kong extractions, M16 revenue by region, Financials tab (US filers, SEC EDGAR).

## Promoted data (admin ran the SQL)

- 489 companies; 34 seed companies (28 US-primary, 5 London, 1 Hong Kong).
- Relationships: 611 promoted, 34 live, 60 rejected.
- Market data: final US run (agent_runs 97 to 124) promoted Oct 29: 58 metrics rows and 32 earnings dates in total. AUR's 2026-11-04 date was promoted by the admin's choice.
- Link 317 (Applied Digital to Corintis, 4%) and link 630 (Pony.ai to Cyantron, 51.0%) each now have a saved quote that states the figure.

## Open

- PR #65 (final run files in `runs/m17_final/`, `runs/m17/promote_market_data_final.sql`) is not merged.
- The full eval run (Monday item 1) was not done. Recall is measured for UBER, CRWV and LYFT only.
- Softcat's FY2026 annual report (published Oct 27) is not extracted; only its preliminary results are.
- Link 467 (CK Hutchison invests in VodafoneThree) may be out of date after the buyout.
- `app/data/snapshot.json` (offline demo) is from Oct 22.
- Saved next-earnings dates in `app/data/market/*.json` are not filtered for past dates; the first one passes on Nov 3.
- Stretch item not started: UK financials from annual reports for VOD, AML, SCT, CCC, BYIT.

## Known limits

- Live prices, stored market data, news and insider trades: US-primary listings only (Finnhub free plan).
- Revenue by region only for VOD, AML, CCC, BYIT, SCT; everyone else uses the HQ region.
- Financial statements "Not loaded" for non-US companies.
- News is not extracted into the graph.

## How to run

```bash
cd ~/gaurberg/app && npm run dev -- -p 3017
```

- Port 3017 stays on main. Test other branches in a separate copy (git worktree) on another port.
- Offline demo: `DEMO_OFFLINE=1 npx next dev -p 3018` (reads `app/data/`, no sign-in, no index ticker).
- Tests: `npm test` in `app/` (listing gate and exposure rules). Typecheck: `npx tsc --noEmit -p .`.
- Market data: `python3 -I agents/market_data/load_fundamentals.py <TICKERS> --out <dir>`, then apply the `<TICKER>_load.sql` files (staged only).

## Rules (from CLAUDE.md and the admin)

- One agent at a time; staged rows only. Never write promoted tables: the admin runs promotion SQL in the Supabase editor.
- Never invent data; label gaps. Cite requirement IDs in commits.
- Each item on its own branch off main, in a separate copy. Open a PR, say what to click, then stop and wait.
- Log every doc change as a new Start Here row (now at v1.44). Do not rewrite earlier decisions; add a dated note.
- Keys stay in server-side secrets; never print or commit them. Models are named by role in `config/models.yaml`.
- If a command fails twice, stop and tell the admin.
