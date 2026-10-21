# Agent: entity_resolution (M3)
`resolve.py TICKER --in DIR --out DIR` maps raw counterparty names to canonical nodes (exact, ticker, alias table, normalized, parenthetical, near-match), makes new nodes for the rest, merges duplicate edges, and reports direction conflicts and every non-exact match for the sampled admin review. Rules only, no model, writes no database rows.
`aliases.csv` holds the alias table with its evidence; `kind=subsidiary` entries would be reported but not merged; Waymo is now `same_entity` under Alphabet (admin decision 2026-10-21).
The scorer uses the same name rules (`match_key`) so gold and predictions compare on canonical names.

## Parent rule (admin decision 2026-10-21)
A unit, subsidiary or brand of a mapped (seed) company never gets its own node. It is shown under the parent: Waymo under Alphabet, Zoox under Amazon, AWS under Amazon, Uber Freight under Uber. Add it to `aliases.csv` as `same_entity` with the parent's canonical name before staging; a link between a company and its own unit is dropped.
The rule applies only when the parent is in the 25 mapped companies. A unit of an unmapped parent (for example Torc Robotics under Daimler Truck) keeps its own node under the name the filing uses, so the map never shows a company the filing did not name.
Existing promoted nodes that fall under this rule are merged only after the admin approves the list (promoted data is never changed without approval).
