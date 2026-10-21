# Agent: entity_resolution (M3)
`resolve.py TICKER --in DIR --out DIR` maps raw counterparty names to canonical nodes (exact, ticker, alias table, normalized, parenthetical, near-match), makes new nodes for the rest, merges duplicate edges, and reports direction conflicts and every non-exact match for the sampled admin review. Rules only, no model, writes no database rows.
`aliases.csv` holds the alias table with its evidence; `kind=subsidiary` entries (Waymo) are reported but not merged until the admin decides.
The scorer uses the same name rules (`match_key`) so gold and predictions compare on canonical names.
