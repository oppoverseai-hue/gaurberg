# Eval harness
- `score_extraction.py`: EXT-1..EXT-7 against `evals/gold/gold_edges.csv`. Companies are discovered from `evals/gold/verdicts/*.csv`; the coverage check runs first and stops the run if any extracted edge has no admin verdict. `--pred-dir` scores a re-run folder; `--selftest` plants errors and checks the scorer notices.
- `record_run.py`: emits SQL for `agent_runs` (model, tokens, cost: RUN-1) and `eval_results`.
- Adding a company: extract it, have the admin review every edge, add `evals/gold/verdicts/<TICKER>.csv`, add 2-3 entries to `evals/gold/negative_picks.json`, run `python3 -I evals/gold/build_gold_set.py`. Skipping any step fails the build.
