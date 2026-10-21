# Agent: filings_extraction (M2 spike on UBER)

Status: spike run once on Uber's FY2025 10-K (filed 2026-02-13). Output is STAGED, awaiting admin review.

Run order:
1. `split_10k.py <10k.htm> <out_dir>`: cut the filing into Business, Risk Factors and MD&A text.
2. The extractor (Claude Code session, Sonnet 5.5 for this run) reads the sections and writes `uber_extraction.py`, which produces `uber_extraction.json` with the exact source sentence for every link.
3. `verify_quotes.py <full.txt> uber_extraction.json`: free check that every quote appears word for word in the filing.
4. `make_load_sql.py uber_extraction.json ../../db/seed/companies_seed.csv`: SQL that writes staged rows only.

Known gaps in this spike: token counts were not captured (session run); entity types for companies the filing does not describe are the extractor's judgement; Risk Factors and MD&A were searched for named companies rather than read in full.

## Batch runner with token logging (M3)
`run_extraction.py TICKER --role extractor_small|extractor_main` fetches the 10-K, sends it in chunks to `claude -p` (model id read from `config/models.yaml` by role), checks every quote word for word, and writes `runs/<role>/<ticker>_extraction.json` plus `<ticker>_run.json` (tokens, cost and seconds for every call). Score it with `evals/harness/score_extraction.py --pred-dir runs/<role> --only TICKER --out runs/<role>/<ticker>_score.json`, record it with `evals/harness/record_run.py`. Output is a re-run folder: nothing is staged or promoted.
