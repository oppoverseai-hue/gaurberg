# Agent: market_data

Status: M17 (DEM-1). Loads stored market metrics, analyst recommendation trends and upcoming earnings dates from Finnhub's free plan (US listings only).

- `probe.py`: one-off capability probe (Phase 1). Report: `docs/market_data_probe.md`.
- `load_fundamentals.py SYMBOL ...`: calls Finnhub profile2, metric, recommendation and calendar/earnings, and writes `runs/m17/<TICKER>_load.sql` (staged rows in company_metrics and company_events, plus one agent_runs row) and `<TICKER>_run.json` (endpoint status, empty fields). Apply the SQL to Supabase like the other agents' load SQL. Safe to re-run. No model call, so tokens and cost are 0.
- Missing values are NULL with the reason in `note`. Analyst EPS and revenue estimates are not stored. Non-US listings return 403 on the free plan: the run is logged as failed and the page says "Not loaded: source is the annual report".
- Financial statements are not loaded here: the Financials tab uses SEC EDGAR (`app/scripts/save-financials.mjs`).
