"""Build the gold set from the admin's verdicts. Nothing is hardcoded per company any more.

Inputs : evals/gold/verdicts/<TICKER>.csv (admin verdicts), the staged extraction JSON they refer to,
         evals/gold/*_news.csv (admin-approved news rows), evals/gold/negative_picks.json (draft negatives).
Outputs: evals/gold/gold_edges.csv  (label = true | false | pending)
         evals/gold/gold_negatives.csv (admin-confirmed negatives, listed in negatives_confirmed.json)
         evals/gold/gold_negatives_draft.csv (label = false, DRAFT until the admin confirms each row)
Run: python3 -I evals/gold/build_gold_set.py   (fails if any extracted edge lacks a verdict: see goldlib.check_coverage)
Requirements: EXT-1..EXT-7 (Eval Spec, gold set specification)."""
import csv, json, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from goldlib import EXTR, GOLD, check_coverage, load_verdicts, news_files, negative_picks, confirmed_negatives

COLS = ["focal_ticker", "counterparty", "relationship_type", "direction", "evidence_url", "quote", "as_of",
        "label", "exposure_pct", "exposure_basis", "exposure_qualifier", "notes"]
DIRECTED = {"supplies", "sells_to", "invests", "acquires"}  # partners and competes are stored undirected
LABEL = {"keep": "true", "drop": "false", "fix": "pending"}


def basis(e):
    if e.get("exposure_pct") is None:
        return ""
    return e.get("exposure_basis") or ("ownership" if e["type"] == "acquires" else "source_revenue")


def main():
    errs = check_coverage()
    if errs:
        print("COVERAGE CHECK FAILED:\n  " + "\n  ".join(errs)); sys.exit(1)
    pos, neg, cache = [], [], {}
    for t, rows in load_verdicts().items():
        for r in rows:
            edges = cache.setdefault(r["file"], json.load(open(EXTR / r["file"])))
            e = edges[int(r["pos"])]
            pct = e.get("exposure_pct")
            pos.append({"focal_ticker": t, "counterparty": e["counterparty"], "relationship_type": e["type"],
                        "direction": f"{e['source']}>{e['target']}" if e["type"] in DIRECTED else "undirected",
                        "evidence_url": e["document_url"], "quote": e["evidence"][0]["quote"], "as_of": e["as_of"],
                        "label": LABEL[r["verdict"]], "exposure_pct": "" if pct is None else pct,
                        "exposure_basis": basis(e), "exposure_qualifier": e.get("exposure_qualifier") or ("exact" if pct is not None else ""),
                        "notes": f"{r['row_id']}; {r['verdict'].title()} ({r['reviewed']}); source=sec_filing" + (f"; {r['note']}" if r["note"] else "")})
            if r["verdict"] == "keep" and e["type"] in DIRECTED and r["row_id"] in negative_picks().get(t, []):
                neg.append((r["row_id"], e, t))
    for p in news_files():
        for r in csv.DictReader(open(p, encoding="utf-8")):
            pos.append({"focal_ticker": r["focal_ticker"], "counterparty": r["counterparty"], "relationship_type": r["relationship_type"],
                        "direction": r["direction"], "evidence_url": r["evidence_url"], "quote": r["quote"], "as_of": r["as_of"],
                        "label": "true", "exposure_pct": "", "exposure_basis": "", "exposure_qualifier": "",
                        "notes": f"{r['id']}; Keep (admin, 2026-10-21); source=news; {r['notes']}"})
    with open(GOLD / "gold_edges.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, COLS); w.writeheader(); w.writerows(pos)
    # DRAFT negatives: the direction-reversed copy of a Keep edge is false by construction (no new facts are claimed).
    rows, conf = [], []
    ok = confirmed_negatives()
    for ident, e, focal in neg:
        other = e["target"] if e["source"] == focal else e["source"]
        row = {"focal_ticker": focal, "counterparty": other, "relationship_type": e["type"],
               "direction": f"{e['target']}>{e['source']}", "evidence_url": "", "quote": "", "as_of": e["as_of"],
               "label": "false", "exposure_pct": "", "exposure_basis": "", "exposure_qualifier": ""}
        if ident in ok.get(focal, []):
            conf.append({**row, "notes": f"Negative {ident}: reversed direction of a Keep edge. Confirmed by the admin 2026-10-21"})
        else:
            rows.append({**row, "notes": f"DRAFT negative: reversed direction of {ident}. Awaiting admin confirmation"})
    with open(GOLD / "gold_negatives.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, COLS); w.writeheader(); w.writerows(conf)
    with open(GOLD / "gold_negatives_draft.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, COLS); w.writeheader(); w.writerows(rows)
    by = {}
    for r in pos:
        k = (r["focal_ticker"], r["label"]); by[k] = by.get(k, 0) + 1
    print("gold_edges.csv:", len(pos), "rows", dict(sorted(by.items())), "| confirmed negatives:", len(conf), "| draft negatives:", len(rows))


if __name__ == "__main__":
    main()
