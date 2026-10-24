# Gaurberg

A Bloomberg-Terminal-lite for independent analysts and small funds: company pages plus an ecosystem map (who supplies, buys from, partners with, competes with, and invests in each company), with a source quote on every link.

Status: scaffold only (M0). Nothing is applied to Supabase yet.

## Layout
- docs/            pointers to the six requirement docs (exports refresh at each gate)
- config/          models.yaml (roles, cost cap)
- db/migrations/   schema from the data contract (13 tables)
- db/seed/         the 25 seed companies (provisional)
- agents/          one folder per agent, built and reviewed one at a time
- evals/           gold set, harness, seeded-error cases
- app/             front end (framework not yet chosen)
- scripts/         helper scripts

## Agent order
market_data, filings_extraction, entity_resolution, verification, orchestrator (last).

## Data licences
- Finnhub free plan is for personal use: this is a demo build, not a licensed redistribution of Finnhub data.
