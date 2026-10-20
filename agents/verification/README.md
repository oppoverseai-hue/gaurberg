# Agent: verification

Status: not built. Built and reviewed one at a time, in this order: market_data, filings_extraction, entity_resolution, verification, orchestrator.

- Spec: Technical Design doc, agent specs section (rules AGT-1 to AGT-5).
- Writes only staged rows. Logs model, tokens and cost to agent_runs.
- Run command: TBD at build time.
