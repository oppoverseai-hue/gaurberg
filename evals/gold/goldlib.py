"""Shared gold-set helpers: where the extraction files and admin verdicts live, and the coverage check.

Rule that scales: every staged extraction file must have an admin verdict for every edge, one row each in
evals/gold/verdicts/<TICKER>.csv (columns row_id,file,pos,counterparty,type,verdict,note,reviewed).
verdict = keep (gold true) | drop (gold false, confirmed negative) | fix (pending: held out of scoring until
the corrected row is supplied). Anything else, or a missing row, fails the coverage check, so a company can no
longer be extracted or scored without a gold set (EXT-1..EXT-7)."""
import csv, glob, json, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parents[2]
EXTR = ROOT / "agents" / "filings_extraction"
GOLD = ROOT / "evals" / "gold"
VERD = GOLD / "verdicts"
VALID = {"keep", "drop", "fix"}


def extraction_files():
    """{TICKER: [filenames]} for every staged extraction output (<ticker>_extraction.json, <ticker>_acq.json)."""
    out = {}
    for p in sorted(glob.glob(str(EXTR / "*.json"))):
        m = re.fullmatch(r"([a-z]+)_(extraction|acq)\.json", pathlib.Path(p).name)
        if m:
            out.setdefault(m.group(1).upper(), []).append(pathlib.Path(p).name)
    return out


def load_verdicts():
    """{TICKER: [row dicts]}"""
    return {p.stem: list(csv.DictReader(open(p, encoding="utf-8"))) for p in sorted(VERD.glob("*.csv"))}


def news_files():
    return sorted(GOLD.glob("*_news.csv"))


def negative_picks():
    p = GOLD / "negative_picks.json"
    return json.load(open(p)) if p.exists() else {}


def check_coverage():
    """Return a list of problems (empty = every extracted edge has a verdict and every verdict has an edge)."""
    errs, ext, ver = [], extraction_files(), load_verdicts()
    for t in sorted(set(ext) - set(ver)):
        errs.append(f"{t}: extraction output exists ({', '.join(ext[t])}) but there is no verdict file verdicts/{t}.csv")
    for t in sorted(set(ver) - set(ext)):
        errs.append(f"{t}: verdict file exists but no extraction output")
    for t in sorted(set(ext) & set(ver)):
        rows, seen = ver[t], set()
        ids = [r["row_id"] for r in rows]
        if len(ids) != len(set(ids)):
            errs.append(f"{t}: duplicate row_id in verdicts")
        for r in rows:
            if r["verdict"] not in VALID:
                errs.append(f"{t} {r['row_id']}: verdict '{r['verdict']}' is not keep/drop/fix")
            if r["verdict"] == "fix" and not r["note"].strip():
                errs.append(f"{t} {r['row_id']}: fix needs the admin's note")
        for f in ext[t]:
            edges = json.load(open(EXTR / f))
            by = {int(r["pos"]): r for r in rows if r["file"] == f}
            for pos, e in enumerate(edges):
                r = by.pop(pos, None)
                if r is None:
                    errs.append(f"{t} {f}[{pos}] {e['counterparty']} {e['type']}: no admin verdict yet")
                elif (r["counterparty"], r["type"]) != (e["counterparty"], e["type"]):
                    errs.append(f"{t} {r['row_id']}: file changed since review (verdict says {r['counterparty']}/{r['type']}, file has {e['counterparty']}/{e['type']})")
                if not all(v.get("quote_found") for v in e["evidence"]):
                    errs.append(f"{t} {f}[{pos}] {e['counterparty']}: quote not found in filing")
            for r in by.values():
                errs.append(f"{t} {r['row_id']}: verdict points at {f}[{r['pos']}] which does not exist")
        # EXT-7 needs 2-3 negatives per ticker: confirmed drops plus draft picks
        n = sum(r["verdict"] == "drop" for r in rows) + len(negative_picks().get(t, []))
        if n < 2:
            errs.append(f"{t}: only {n} negatives (drops + picks); EXT-7 needs 2-3 per ticker")
    return errs


if __name__ == "__main__":
    import sys
    problems = check_coverage()
    print("coverage ok" if not problems else "COVERAGE CHECK FAILED:\n  " + "\n  ".join(problems))
    sys.exit(1 if problems else 0)
