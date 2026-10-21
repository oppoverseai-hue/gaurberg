"""Build the seeded-error set for VER-1 and VER-2 from the admin's Keep edges (filing-sourced only).

For every Keep edge: one correct copy (planted = none) and one copy with ONE planted error, cycling through
direction (directed types only), type, and unsupported (the quote is replaced by a sentence from a different edge that does not name the counterparty).
The verifier never sees the planted label; items get opaque ids. Deterministic (seed 7).
Run: python3 -I evals/seeded_errors/build_seeded.py   ->  evals/seeded_errors/seeded_set.json"""
import json, pathlib, random, sys
HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / "evals" / "gold"))
from goldlib import EXTR, load_verdicts, check_coverage  # noqa: E402

DIRECTED = {"supplies", "sells_to", "invests", "acquires"}
WRONG = {"competes": "partners", "partners": "competes", "invests": "partners", "sells_to": "competes", "supplies": "competes", "acquires": "partners"}


def main():
    errs = check_coverage()
    assert not errs, errs
    rng = random.Random(7)
    items = []
    for t, rows in load_verdicts().items():
        edges = {r["row_id"]: json.load(open(EXTR / r["file"]))[int(r["pos"])] for r in rows if r["verdict"] == "keep"}
        pool = list(edges.items())
        for n, (rid, e) in enumerate(pool):
            base = {"focal": t, "counterparty": e["counterparty"], "type": e["type"], "source": e["source"], "target": e["target"],
                    "quote": e["evidence"][0]["quote"], "quote_found": True}
            items.append({"gold_row": rid, "planted": "none", **base})
            kinds = ["direction", "type", "unsupported"] if e["type"] in DIRECTED else ["type", "unsupported"]
            kind = kinds[n % len(kinds)]
            bad = dict(base)
            if kind == "direction":
                bad["source"], bad["target"] = base["target"], base["source"]
            elif kind == "type":
                bad["type"] = WRONG[e["type"]]
                if bad["type"] in ("competes", "partners"):  # undirected types keep the focal company as source
                    bad["source"], bad["target"] = t, e["counterparty"]
            else:
                cp = e["counterparty"].lower()
                others = [x["evidence"][0]["quote"] for r2, x in pool if x["counterparty"] != e["counterparty"] and cp not in x["evidence"][0]["quote"].lower()]
                bad["quote"] = rng.choice(others)
            items.append({"gold_row": rid, "planted": kind, **bad})
    rng.shuffle(items)
    for i, it in enumerate(items, 1):
        it["id"] = f"e{i:03d}"
    json.dump(items, open(HERE / "seeded_set.json", "w"), ensure_ascii=False, indent=1)
    from collections import Counter
    print(len(items), "items", dict(Counter(i["planted"] for i in items)))


if __name__ == "__main__":
    main()
