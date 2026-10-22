# M14 Vodafone (VOD), Annual Report 2026 (year to 31 March 2026)

Staged run: agent_runs id 48, 45 links, 70 evidence rows, all status `staged`, none promoted. Nothing else was written.
Extractor: run_report.py, role `extractor` (claude-sonnet-5-5). Two passes (v1 75 edges, v2 58 edges); total list-price cost $4.39, 1,301,044 tokens in, 54,951 out.
Quotes: every quote is exact text from the report (0 not found). Pages are recorded in evidence.section (for example `p19`). No document URL or publication date is stored because the report was supplied as a PDF.

## For the admin review (Keep / Fix / Drop)
Likely Drop or Fix:
- `partners` Oak Holdings 1 GmbH (duplicate of Oak Holdings), `partners` Three UK / CK Hutchison with weak quotes, `partners` Telecommunication Infrastructure Company of Iran (consortium cable member, state-controlled, decide if it belongs).
- `acquires` VOD -> CK Hutchison (49% buyout of the telecom holding company; alias to CK Hutchison needs confirming), `acquires` VOD -> Safaricom (quote is a share purchase agreement; Vodacom is treated as part of Vodafone, alias needs confirming).
- Shareholders e&, BlackRock, Norges Bank (`invests` into VOD): kept on purpose, quote is the major-holders table.
- `invests` VOD -> Liberty Global: the 10% stake is in the new Ziggo Group, not Liberty Global, so the percentage was removed.
Aliases added for admin confirmation: Vodacom and Vodacom Group Limited -> Vodafone Group; CK Hutchison Group Telecom Holding Limited -> CK Hutchison.

## Deals dropped because they do not involve Vodafone Group itself (10)
Liberty Global acquires VodafoneZiggo (x2), Swisscom acquires Vodafone Italia (x2), Zegona acquires Vodafone Spain, Safaricom acquires M-Pesa Holding, CK Hutchison invests VodafoneThree (x2), Accenture invests Vodafone Shared Operations (x2).
The schema cannot show a sale of a unit (Vodafone Italia, Vodafone Spain) without a node for the unit. Listed in resolved/vod_resolution_report.json (`dropped_not_focal`).

## Loader and resolver fixes made in this run (also apply to later US runs)
- Ownership percentages are stored with basis `ownership` for invests/acquires (they used to default to source revenue).
- entity_type `government` maps to `institution` and `other` to `organization` (the companies table does not allow the first two).
- resolve.py now resolves a unit to the focal company by alias and drops deals between two other companies instead of producing a self-link.
