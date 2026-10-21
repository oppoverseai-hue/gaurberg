"""Build the first gold set (CRWV, LYFT) from the admin's Keep verdicts in the M3 review doc.

Rows come straight from the staged extraction JSON (quotes are not retyped) plus the admin-approved
news rows in lyft_av_news.csv. Run from anywhere: python3 -I evals/gold/build_gold_set.py
Writes evals/gold/gold_edges.csv (label=true) and evals/gold/gold_negatives_draft.csv (label=false, DRAFT).
Requirements: EXT-1..EXT-7 (Eval Spec, gold set specification)."""
import csv, json, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
EXTR = ROOT / "agents" / "filings_extraction"
GOLD = ROOT / "evals" / "gold"
COLS = ["focal_ticker", "counterparty", "relationship_type", "direction", "evidence_url", "quote", "as_of",
        "label", "exposure_pct", "exposure_basis", "exposure_qualifier", "notes"]
DIRECTED = {"supplies", "sells_to", "invests", "acquires"}  # partners and competes are stored undirected

# Admin verdicts (Keep) from the M3 review doc, in file order. Names are checked so a reordered file fails loudly.
SOURCES = [
    ("crwv_extraction.json", "CRWV", "C", 1, ["Microsoft", "OpenAI", "Meta", "NVIDIA", "NVIDIA", "NVIDIA", "Amazon", "Alphabet",
                                              "Microsoft", "Oracle", "AMD", "Intel", "Magnetar"]),
    ("lyft_extraction.json", "LYFT", "L", 1, ["Uber", "Bolt", "Lime", "Bird", "Fifteen", "nextbike", "Dott", "Alphabet", "Amazon",
                                              "Baidu", "Tesla", "Amazon", "ADT", "RapidSOS"]),
    ("crwv_acq.json", "CRWV", "A", 9, ["Weights & Biases", "OpenPipe", "Marimo", "Monolith"]),
    ("lyft_acq.json", "LYFT", "A", 13, ["Freenow", "TBR", "Flexdrive"]),
]
VERDICT = "Keep (admin, 2026-10-21)"


def direction(e, focal):
    if e["type"] not in DIRECTED:
        return "undirected"
    return f"{e['source']}>{e['target']}"


def basis(e):
    if e.get("exposure_pct") is None:
        return ""
    return e.get("exposure_basis") or ("ownership" if e["type"] == "acquires" else "source_revenue")


def main():
    pos, neg = [], []
    for fname, focal, prefix, start, names in SOURCES:
        edges = json.load(open(EXTR / fname))
        got = [e["counterparty"] for e in edges]
        assert got == names, f"{fname}: order or names changed vs the review doc: {got}"
        for i, e in enumerate(edges, start):
            assert all(v["quote_found"] for v in e["evidence"]), f"{prefix}{i}: quote not found"
            pct = e.get("exposure_pct")
            pos.append({
                "focal_ticker": focal, "counterparty": e["counterparty"], "relationship_type": e["type"],
                "direction": direction(e, focal), "evidence_url": e["document_url"], "quote": e["evidence"][0]["quote"],
                "as_of": e["as_of"], "label": "true", "exposure_pct": "" if pct is None else pct,
                "exposure_basis": basis(e), "exposure_qualifier": e.get("exposure_qualifier") or ("exact" if pct is not None else ""),
                "notes": f"{prefix}{i}; {VERDICT}; source=sec_filing"})
            if e["type"] in DIRECTED:
                neg.append((f"{prefix}{i}", e, focal))
    for r in csv.DictReader(open(GOLD / "lyft_av_news.csv", encoding="utf-8")):
        pos.append({"focal_ticker": r["focal_ticker"], "counterparty": r["counterparty"], "relationship_type": r["relationship_type"],
                    "direction": r["direction"], "evidence_url": r["evidence_url"], "quote": r["quote"], "as_of": r["as_of"],
                    "label": "true", "exposure_pct": "", "exposure_basis": "", "exposure_qualifier": "",
                    "notes": f"{r['id']}; {VERDICT}; source=news; {r['notes']}"})
    with open(GOLD / "gold_edges.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, COLS); w.writeheader(); w.writerows(pos)

    # DRAFT negatives: the direction-reversed copy of a Keep edge is false by construction (no new facts are claimed).
    # Three per company, not counted as gold until the admin confirms each row.
    pick = {"CRWV": ["C1", "C4", "C5"], "LYFT": ["L12", "A13", "A14"]}
    rows = []
    for ident, e, focal in neg:
        if ident in pick[focal]:
            other = e["target"] if e["source"] == focal else e["source"]
            rows.append({"focal_ticker": focal, "counterparty": other, "relationship_type": e["type"],
                         "direction": f"{e['target']}>{e['source']}", "evidence_url": "", "quote": "", "as_of": e["as_of"],
                         "label": "false", "exposure_pct": "", "exposure_basis": "", "exposure_qualifier": "",
                         "notes": f"DRAFT negative: reversed direction of {ident}. Awaiting admin confirmation"})
    with open(GOLD / "gold_negatives_draft.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, COLS); w.writeheader(); w.writerows(rows)
    by = {}
    for r in pos:
        by[r["focal_ticker"]] = by.get(r["focal_ticker"], 0) + 1
    print(f"gold_edges.csv: {len(pos)} true edges {by}; gold_negatives_draft.csv: {len(rows)} draft negatives")


if __name__ == "__main__":
    main()
