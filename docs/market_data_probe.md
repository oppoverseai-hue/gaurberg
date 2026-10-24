# Market-data capability probe

Run: 2026-10-22 16:19 UTC. Script: `agents/market_data/probe.py`. Calls made: 88.

Cell key: OK (rows returned) plus latest period / news count / next date where relevant; EMPTY = 200 with no data; 403 = plan does not include it; ERROR = other failure. Raw payloads were not saved.

Symbol formats: Finnhub uses `TICKER.L` for London; Twelve Data uses `symbol=TICKER&exchange=LSE`.

| ticker | fh profile2 | fh metric | fh financials-reported | fh company-news | fh calendar/earnings | fh price-target | fh recommendation | td income_statement | td balance_sheet | td cash_flow | td earnings_calendar |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AAPL | OK (1) | OK (133) | OK (16) 2025-09-27 | OK (247) 247 items | OK (1) 2026-11-02 | 403 (HTTP 403) | OK (4) 2026-10-01 | OK (6) 2025-09-30 | OK (6) 2025-09-30 | OK (6) 2025-09-30 | 403 (HTTP 403) |
| UBER | OK (1) | OK (123) | OK (7) 2025-12-31 | OK (229) 229 items | OK (1) 2026-11-04 | 403 (HTTP 403) | OK (4) 2026-10-01 | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) |
| LYFT | OK (1) | OK (123) | OK (7) 2025-12-31 | OK (49) 49 items | OK (1) 2026-11-05 | 403 (HTTP 403) | OK (4) 2026-10-01 | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) |
| VOD.L | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) |
| AML.L | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) |
| SCT.L | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) |
| CCC.L | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) |
| BYIT.L | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) |

## By endpoint

| endpoint | AAPL | UBER | LYFT | VOD.L | AML.L | SCT.L | CCC.L | BYIT.L |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| fh profile2 | OK (1) | OK (1) | OK (1) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) |
| fh metric | OK (133) | OK (123) | OK (123) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) |
| fh financials-reported | OK (16) 2025-09-27 | OK (7) 2025-12-31 | OK (7) 2025-12-31 | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) |
| fh company-news | OK (247) 247 items | OK (229) 229 items | OK (49) 49 items | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) |
| fh calendar/earnings | OK (1) 2026-11-02 | OK (1) 2026-11-04 | OK (1) 2026-11-05 | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) |
| fh price-target | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) |
| fh recommendation | OK (4) 2026-10-01 | OK (4) 2026-10-01 | OK (4) 2026-10-01 | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) |
| td income_statement | OK (6) 2025-09-30 | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) |
| td balance_sheet | OK (6) 2025-09-30 | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) |
| td cash_flow | OK (6) 2025-09-30 | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) |
| td earnings_calendar | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) | 403 (HTTP 403) |

## Findings

- **US (AAPL, UBER, LYFT):** Finnhub free plan returns profile, metrics (123–133 fields), annual reported financials (latest FY2025), 30-day news, the next earnings date and recommendation trends. Price target is 403 for all tickers (premium).
- **UK (all five `.L` tickers):** every Finnhub and Twelve Data endpoint is 403. That is a plan restriction, not a symbol-format problem: Finnhub's free plan is US-only for these endpoints. No alternative format was tried, to stay inside the call budget.
- **Twelve Data statements:** OK only for AAPL. That matches Twelve Data's free-plan demo-symbol behaviour, not real coverage; UBER and LYFT are 403. The earnings calendar is 403 for all.
- **Usable for Phase 2 on the current plans:** Finnhub profile2, metric, financials-reported, company-news, calendar/earnings and recommendation, for US tickers only. UK companies would show "Not loaded: source is the annual report".
