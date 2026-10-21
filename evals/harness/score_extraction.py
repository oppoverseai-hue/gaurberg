"""Score extracted edges against the gold set: EXT-1 to EXT-7 (Eval Spec thresholds accepted by the admin on 2026-10-21).

Usage:  python3 -I evals/harness/score_extraction.py [--selftest] [--out report.json]
Predictions are the staged extraction JSON files (the same files that were loaded into the staging tables).

Matching, one-to-one per company, in three passes: (1) same pair, type and direction; (2) same pair and type;
(3) same pair. partners and competes are undirected (the database keeps the lower company id as source).
  EXT-1 precision = matched / predicted        EXT-2 recall = matched / gold true edges
  EXT-3 direction = among matched directed gold edges, share with the right direction
  EXT-4 type      = among matched edges, share with the right type
  EXT-5 quote support = admin review (every staged 10-K edge was marked Keep); reported, not computed here
  EXT-6 unsupported = predicted edges with no quote, or a quote not found in the filing (must be zero)
  EXT-7 false-positive rate = share of gold negatives the agent also produced (admin-confirmed negatives only)"""
import argparse, copy, csv, json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "evals" / "gold"))
sys.path.insert(0, str(ROOT / "agents" / "entity_resolution"))
import goldlib  # noqa: E402
from resolve import match_key  # noqa: E402  (same name rules as the entity resolution agent)  (coverage check and file discovery; no per-company lists live here)
EXTR, GOLD = goldlib.EXTR, goldlib.GOLD
DIRECTED = {"supplies", "sells_to", "invests", "acquires"}
ALIAS = {"waymo": "alphabet", "google": "alphabet", "intel corporation": "intel"}
THRESH = {"EXT-1": (0.90, ">="), "EXT-2": (0.60, ">="), "EXT-3": (0.95, ">="), "EXT-4": (0.90, ">="), "EXT-6": (0, "=="), "EXT-7": (0.10, "<=")}


def norm(s):
    s = match_key(s.strip())
    return ALIAS.get(s, s)


def key(focal, other, typ, src, tgt):
    d = f"{norm(src)}>{norm(tgt)}" if typ in DIRECTED else "undirected"
    return {"pair": frozenset([norm(focal), norm(other)]), "type": typ, "dir": d}


def load_pred(pred_dir=None):
    """Predictions: the staged extraction files (default) or a re-run's output folder. Companies come from the files."""
    out = []
    src = pathlib.Path(pred_dir) if pred_dir else EXTR
    files = [(f, t) for t, fs in goldlib.extraction_files().items() for f in fs] if not pred_dir else [
        (p.name, p.name.split("_")[0].upper()) for p in sorted(src.glob("*.json")) if p.name.split("_")[0].isalpha() and p.name.endswith(("_extraction.json", "_acq.json"))]
    for fname, focal in files:
        for e in json.load(open(src / fname)):
            other = e["target"] if e["source"] == focal else e["source"]
            out.append({**key(focal, other, e["type"], e["source"], e["target"]), "focal": focal,
                        "supported": bool(e["evidence"]) and all(v.get("quote_found") and v["quote"] for v in e["evidence"])})
    return out


def load_gold(name, label):
    out = []
    for r in csv.DictReader(open(GOLD / name, encoding="utf-8")):
        if r["label"] != label:
            continue
        src, tgt = (r["direction"].split(">") + [""])[:2] if ">" in r["direction"] else (r["focal_ticker"], r["counterparty"])
        out.append({**key(r["focal_ticker"], r["counterparty"], r["relationship_type"], src, tgt), "focal": r["focal_ticker"]})
    return out


def match(gold, pred):
    """One-to-one matches (gold_index, pred_index) in three passes."""
    gi, pi, pairs = set(range(len(gold))), set(range(len(pred))), []
    for same in (lambda g, p: g["pair"] == p["pair"] and g["type"] == p["type"] and g["dir"] == p["dir"],
                 lambda g, p: g["pair"] == p["pair"] and g["type"] == p["type"],
                 lambda g, p: g["pair"] == p["pair"]):
        for g in sorted(gi):
            for p in sorted(pi):
                if same(gold[g], pred[p]):
                    pairs.append((g, p)); gi.discard(g); pi.discard(p); break
    return pairs


def ratio(a, b):
    return None if b == 0 else a / b


def score(gold, pred, negatives):
    pairs = match(gold, pred)
    m = len(pairs)
    directed = [(g, p) for g, p in pairs if gold[g]["type"] in DIRECTED]
    r = {"EXT-1": ratio(m, len(pred)), "EXT-2": ratio(m, len(gold)),
         "EXT-3": ratio(sum(gold[g]["dir"] == pred[p]["dir"] for g, p in directed), len(directed)),
         "EXT-4": ratio(sum(gold[g]["type"] == pred[p]["type"] for g, p in pairs), m),
         "EXT-6": sum(not p["supported"] for p in pred)}
    if negatives is not None:
        bad = sum(any(n["pair"] == p["pair"] and n["type"] == p["type"] and n["dir"] == p["dir"] for p in pred) for n in negatives)
        r["EXT-7"] = ratio(bad, len(negatives))
    r["counts"] = {"predicted": len(pred), "gold_true": len(gold), "matched": m,
                   "missed": [sorted(gold[g]["pair"]) + [gold[g]["type"]] for g in range(len(gold)) if g not in {x[0] for x in pairs}]}
    return r


def verdict(tid, v):
    if v is None:
        return "not run"
    t, op = THRESH[tid]
    ok = {">=": v >= t, "<=": v <= t, "==": v == t}[op]
    return "pass" if ok else "fail"


def run(gold_all, pred_all, neg_all, tag):
    res = {}
    for focal in sorted({x["focal"] for x in gold_all}) + ["ALL"]:
        g = [x for x in gold_all if focal in ("ALL", x["focal"])]
        p = [x for x in pred_all if focal in ("ALL", x["focal"])]
        n = None if neg_all is None else [x for x in neg_all if focal in ("ALL", x["focal"])]
        res[focal] = score(g, p, n)
    return res


def selftest(gold, pred):
    """Plant errors and check the scorer notices them. Returns a list of failures."""
    fails = []
    base = score(gold, pred, None)
    p2 = [x for x in pred if not (x["type"] == "supplies" and "nvidia" in x["pair"])]
    if not (score(gold, p2, None)["EXT-2"] < base["EXT-2"]): fails.append("dropped edge did not lower recall")
    p3 = copy.deepcopy(pred)
    i = next(k for k, x in enumerate(p3) if x["type"] == "supplies")
    a, b = p3[i]["dir"].split(">"); p3[i]["dir"] = f"{b}>{a}"
    if not (score(gold, p3, None)["EXT-3"] < base["EXT-3"]): fails.append("reversed edge did not lower direction accuracy")
    p4 = copy.deepcopy(pred)
    i = next(k for k, x in enumerate(p4) if x["type"] == "competes"); p4[i]["type"] = "partners"
    if not (score(gold, p4, None)["EXT-4"] < base["EXT-4"]): fails.append("wrong type did not lower type accuracy")
    p5 = pred + [{**key("LYFT", "Zoox", "partners", "LYFT", "Zoox"), "focal": "LYFT", "supported": True}]
    if not (score(gold, p5, None)["EXT-1"] < base["EXT-1"]): fails.append("extra edge did not lower precision")
    p6 = copy.deepcopy(pred); p6[0]["supported"] = False
    if score(gold, p6, None)["EXT-6"] != 1: fails.append("unsupported edge not counted")
    return fails


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-ext7", action="store_true", help="skip EXT-7 (it uses the admin-confirmed negatives by default)")
    ap.add_argument("--selftest", action="store_true"); ap.add_argument("--out")
    ap.add_argument("--pred-dir", help="score a re-run's output folder instead of the staged extraction files")
    ap.add_argument("--only", help="comma list of tickers to score (default: every company with a verdict file)")
    a = ap.parse_args()
    if not a.pred_dir:
        errs = goldlib.check_coverage()
        if errs:
            print("COVERAGE CHECK FAILED (a company has extraction output without a full gold set):\n  " + "\n  ".join(errs)); sys.exit(2)
    gold, pred = load_gold("gold_edges.csv", "true"), load_pred(a.pred_dir)
    pending = load_gold("gold_edges.csv", "pending")
    pred = [p for p in pred if not any(p["pair"] == q["pair"] and p["type"] == q["type"] for q in pending)]  # held out: admin Fix not yet resolved
    if a.only:
        keep = {t.strip().upper() for t in a.only.split(",")}
        gold, pred = [x for x in gold if x["focal"] in keep], [x for x in pred if x["focal"] in keep]
    if a.selftest:
        f = selftest(gold, pred)
        print("selftest:", "ok" if not f else f); sys.exit(1 if f else 0)
    neg = None if a.no_ext7 else load_gold("gold_negatives.csv", "false") + load_gold("gold_edges.csv", "false")
    res = run(gold, pred, neg, "m3")
    for focal, r in res.items():
        print(f"\n== {focal}: predicted {r['counts']['predicted']}, gold {r['counts']['gold_true']}, matched {r['counts']['matched']}")
        for tid in ("EXT-1", "EXT-2", "EXT-3", "EXT-4", "EXT-6", "EXT-7"):
            v = r.get(tid)
            shown = "n/a" if v is None else (f"{v:.1%}" if tid != "EXT-6" else str(v))
            print(f"  {tid}: {shown:>7}  {verdict(tid, v)}" )
        if r["counts"]["missed"]:
            print("  missed:", "; ".join(" ".join(m) for m in r["counts"]["missed"]))
    if a.out:
        json.dump(res, open(a.out, "w"), indent=1, default=list)


if __name__ == "__main__":
    main()
