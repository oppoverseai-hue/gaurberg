# Live lookup (M7, card J5)

* App path: search page -> `Look it up live` -> edge function `supabase/functions/live-lookup` (free-tier Gemini, server-side key, cap $0).
  Steps shown by name: Finding the latest filing, Reading the filing, Finding links, Checking quotes, Saving. Links without a found quote are dropped (LIV-E6).
  Rows are written `status=live`, `trust_status=live_generated`; they are never promoted automatically (rule 3).
* Limits: one lookup per person per day (admin exempt), cached companies cost nothing, `lookup_log` records every request.
* Queue (LIV-E9): when the free allowance is used up the row is `queued` and the page says so. Claude Code processes the queue in order, on the admin's subscription:
  1. `select id,ticker,query from lookup_queue where status='queued' order by id;`
  2. `python3 -I agents/filings_extraction/run_extraction.py TICKER --role extractor --out runs/live` then `agents/entity_resolution/resolve.py TICKER --in runs/live --out runs/live_resolved`
  3. `python3 -I agents/filings_extraction/make_load_sql.py runs/live_resolved/<t>_extraction.json db/seed/companies_seed.csv --ticker TICKER --filed YYYY-MM-DD --live-queue-id ID --cost <run cost>`, run the SQL, which also marks the queue row done.
* Secrets to set in Supabase (Edge Functions > Secrets): `GEMINI_API_KEY`, `LIVE_LOOKUP_MODEL` (value from `live_lookup` in config/models.yaml).
