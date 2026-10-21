"""Emit idempotent SQL that reloads the gold_edges table from gold_edges.csv (confirmed rows only, never the drafts).
Usage: python3 -I evals/gold/load_gold_sql.py > load_gold.sql   (then run it against the project database)"""
import csv, pathlib
q = lambda s: "null" if s in ("", None) else "$q$" + s + "$q$"
rows = list(csv.DictReader(open(pathlib.Path(__file__).resolve().parent / "gold_edges.csv", encoding="utf-8")))
tick = sorted({r["focal_ticker"] for r in rows})
vals = ",".join("(" + ",".join([q(r["focal_ticker"]), q(r["counterparty"]), q(r["relationship_type"]), q(r["direction"]), q(r["evidence_url"]),
                                 q(r["quote"]), q(r["as_of"]) + "::date", q(r["label"]), q(r["exposure_pct"]) + "::numeric",
                                 q(r["exposure_basis"]), q(r["exposure_qualifier"]), q(r["notes"])]) + ")" for r in rows)
print("begin;\ndelete from public.gold_edges where focal_ticker in (" + ",".join(f"'{t}'" for t in tick) + ");")
print("insert into public.gold_edges(focal_ticker,counterparty,relationship_type,direction,evidence_url,quote,as_of,label,exposure_pct,exposure_basis,exposure_qualifier,notes) values " + vals + ";\ncommit;")
