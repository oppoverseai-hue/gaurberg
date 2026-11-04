# Daily market-data refresh (DEM-1, DEM-3, TRM-13)

Runs in the cloud as a Vercel Cron job, every day at 11:00 UTC (19:00 Makassar). On the Hobby plan Vercel may start it any time within that hour.

- Route: `app/src/app/api/cron/refresh/route.ts`. Schedule: `app/vercel.json`.
- Rules for earnings dates: `app/src/lib/refresh-core.ts`, tested in `app/tests/refresh.test.mjs`.
- Each run writes one `agent_runs` row (`agent_name = market_refresh`) when it starts (status `running`) and fills it in at the end. The run stops starting new work after 250 s, so it is always logged inside Vercel's 300 s limit. The admin page shows the last 7 runs and turns "stale" after 36 hours without a good run.

## What it writes (US-primary mapped companies only)

| Table | What | Status |
| --- | --- | --- |
| price_cache | Last close from Finnhub, one row per New York trading day; missing closes from Twelve Data for up to 5 companies a run; first run seeds each company from its saved file | (no status column) |
| company_metrics | Today's ratios and analyst counts | promoted; a row the admin rejected is never overwritten |
| company_events | Earnings dates from 3 weeks back to 90 days ahead | new quarters promoted; a rejected date never returns; any change to a published date is staged for review while the published date stays |

It never writes companies, relationships or evidence, and makes no model call.

## Setup (admin, once, in Vercel → Project → Settings → Environment Variables, Production)

- `CRON_SECRET`: any long random string. Vercel sends it to the route; other callers get 401.
- `SUPABASE_SERVICE_ROLE_KEY`: from Supabase → Project Settings → API keys (service role / secret key). Server only; never prefix it with NEXT_PUBLIC.
- `FINNHUB_API_KEY` and `TWELVEDATA_API_KEY` are already set.

Redeploy after adding them. To test once without waiting, run the job from Vercel → Project → Settings → Cron Jobs → Run.

The Mac launchd job (`app/scripts/launchd`) is no longer needed for the hosted app; it only refreshes the files the offline demo reads.
