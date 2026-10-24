# Gaurberg: rules for Claude Code

Start by reading the "Start Here" doc (see docs/README.md for links). Then read only the cards and docs listed for the current milestone.

1. Read Start Here first, then the cards and docs listed for the current milestone. Cite requirement IDs (for example EXP-1, APP-16) in commit messages.
2. Build only the current milestone. Do not start the next one until its gate passes and the admin approves.
3. Run one agent at a time, on one company first, and write only staged rows.
4. Never write to promoted tables. Promotion is a separate, admin-approved command.
5. Log model, tokens and cost for every model call (agent_runs).
6. Keep keys in server-side secrets. Never print or commit them.
7. Run the relevant evals after each change and save the run record (eval_results).
8. Respect the hours budget per milestone, the Wednesday 20:00 (Makassar) kill rule and the scope-change rule.
9. Never invent data. Label gaps as Sample.

Language: English only for all communication and project files.
Models are named by role in config/models.yaml. Never hardcode a model id elsewhere.

Market-data tables (company_metrics, company_events; M17) are separate from the promoted-edge tables. The market_data loader writes only staged rows there and never writes companies or relationships.
