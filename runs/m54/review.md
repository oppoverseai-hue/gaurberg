# Staged SEC report dates for review: rerun (GRF-20)

Rerun of `agents/market_data/load_report_dates.py` on Nov 5, 2026 for the 28 US-primary seed companies, for New York dates before 2026-11-05.
Every filing it kept was already stored by run 127 (83 rows, promoted) except one, which is the only row written. **Staged, not promoted.**

| Company | Quarter (as named) | Report date | Accepted (ET / UTC) | Rule applied | Filing |
| --- | --- | --- | --- | --- | --- |
| UBER | Q3 2026 ("Third Quarter 2026") | 2026-11-04 | 06:55 ET / 11:55 UTC | before market open: 2026-11-04 vs 2026-11-03; flagged for now (Reported 2026-11-04: no stored close yet for the trading day that reacted; the last stored close is 2026-11-03) | [8-K](https://www.sec.gov/Archives/edgar/data/1543151/000154315126000039/uber-20261104.htm) |

- Written as `company_events` id 156, `agent_runs` id 128, status `staged`.
- No duplicates: no SEC filing is stored twice (run 127: 83 promoted; run 128: 1 staged).
- Uber also has a promoted Finnhub row for 2026-11-04 (id 2, "Q3 2026, before market open"); it agrees with the 8-K's timing. The pages show one report per company and date.
- Once the daily refresh stores Uber's Nov 4 close, the rule gives Nov 4 against Nov 3 (66.60). Nothing is estimated before then.
