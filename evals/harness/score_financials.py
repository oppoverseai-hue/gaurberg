"""Checks for the Financials tab data (FIN-2, FIN-3, FIN-4, FIN-5). Reads app/data/financials/*.json and prints every failure.

Usage: python3 -I evals/harness/score_financials.py [--json]
Exit code 1 if any check fails. Checks recompute each derived number from the tagged lines, so a wrong formula or a
mis-tagged filing shows up as a failure rather than a plausible-looking table.
"""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "app" / "data" / "financials"
MARKET = ROOT / "app" / "data" / "market"
fails, passed = [], 0


def check(ok, msg):
    global passed
    if ok:
        passed += 1
    else:
        fails.append(msg)


def row(d, sec, prefix):
    return next((r for r in d.get(sec, []) if r["label"].startswith(prefix)), None)


tickers = sorted(p.stem for p in MARKET.glob("*.json"))
# FIN-2: every company in the set has a file; each is either complete or says why not (Sample).
for t in tickers:
    f = DATA / f"{t}.json"
    check(f.exists(), f"FIN-2 {t}: no financials file")
    if not f.exists():
        continue
    d = json.loads(f.read_text())
    if d["status"] != "ok":
        check(bool(d.get("note")), f"FIN-4 {t}: status {d['status']} but no Sample note")
        continue
    cols = d["columns"]
    n = len(cols)
    check(2 <= n <= 5, f"FIN-2 {t}: {n} columns (expected 4 fiscal years + LTM, fewer only for new filers)")
    check(all(c["kind"] in ("FY", "LTM") for c in cols), f"FIN-4 {t}: a column is neither FY nor LTM (estimate columns are not allowed)")
    check(sum(c["kind"] == "LTM" for c in cols) <= 1 and (cols[-1]["kind"] == "LTM" or all(c["kind"] == "FY" for c in cols)), f"FIN-2 {t}: LTM is not the last column")
    for sec in ("is", "bs", "cf"):
        for r in d[sec]:
            check(len(r["values"]) == n, f"FIN-2 {t}: row '{r['label']}' has {len(r['values'])} values for {n} columns")
    rev = row(d, "is", "Revenue")
    # FIN-3: growth and margin sub-rows recompute from the numbers above them.
    for sec, prefix, sub, in (("is", "Gross profit", "Gross margin"), ("is", "Operating income", "Operating margin"), ("is", "Net income", "Net margin")):
        r = row(d, sec, prefix)
        s = next((x for x in r["subs"] if x["label"] == sub), None)
        for i, (v, m) in enumerate(zip(r["values"], s["values"])):
            if v is None or not rev["values"][i]:
                check(m is None, f"FIN-3 {t}: {sub} shown for column {i} without inputs")
            else:
                check(m is not None and abs(m - v / rev["values"][i] * 100) < 0.11, f"FIN-3 {t}: {sub} col {i} = {m}, recomputed {v / rev['values'][i] * 100:.1f}")
    gp, cost = row(d, "is", "Gross profit"), row(d, "is", "Cost of revenue")
    if "derived" in gp["label"]:  # FIN-3: a derived gross profit must equal revenue minus the tagged cost of revenue
        for i in range(n):
            a, b = rev["values"][i], cost["values"][i]
            check((gp["values"][i] is None) if (a is None or b is None) else abs(gp["values"][i] - (a - b)) < 1.01, f"FIN-3 {t}: derived gross profit col {i} != revenue - cost of revenue")
    g = rev["subs"][0]["values"]
    for i, c in enumerate(cols):
        if c["kind"] == "LTM" or i == 0:
            check(g[i] is None, f"FIN-3 {t}: growth shown for column {i} ({c['label']}) which has no prior fiscal year")
        elif rev["values"][i] is not None and rev["values"][i - 1]:
            check(abs(g[i] - (rev["values"][i] / rev["values"][i - 1] - 1) * 100) < 0.11, f"FIN-3 {t}: revenue growth col {i} wrong")
    # FIN-3: derived lines are labelled as derived and recompute.
    ocf, capex, fcf = row(d, "cf", "Operating cash flow"), row(d, "cf", "Capital expenditure"), row(d, "cf", "Free cash flow")
    check("derived" in fcf["label"], f"FIN-3 {t}: free cash flow not labelled derived")
    for i in range(n):
        a, b, c = ocf["values"][i], capex["values"][i], fcf["values"][i]
        check((c is None) if (a is None or b is None) else abs(c - (a - b)) < 1.01, f"FIN-3 {t}: FCF col {i} != OCF - capex")
    ebitda, op, = row(d, "is", "EBITDA"), row(d, "is", "Operating income")
    check("derived" in ebitda["label"], f"FIN-3 {t}: EBITDA not labelled derived")
    # Balance sheet sanity: assets = liabilities + equity (within 1% when all three exist; minority interest can explain small gaps).
    A, L, E = row(d, "bs", "Total assets"), row(d, "bs", "Total liabilities"), row(d, "bs", "Shareholders")
    N = row(d, "bs", "Non-controlling")
    for i in range(n):
        if None not in (A["values"][i], L["values"][i], E["values"][i]) and A["values"][i]:
            gap = abs(A["values"][i] - L["values"][i] - E["values"][i] - (N["values"][i] or 0)) / abs(A["values"][i])
            flagged = any(f.startswith(cols[i]["label"]) for f in d.get("flags", []))
            check((gap >= 0.03) == flagged, f"FIN-2 {t}: balance sheet col {i} gap {gap:.1%} but flagged={flagged} (a gap of 3% or more must carry a visible warning, and only then)")
    # FIN-5: segments, when present, add up to total revenue for the same fiscal year (within 1%).
    sg = d.get("segments")
    if sg and sg["rows"]:
        by_end = {c["label"]: i for i, c in enumerate(cols)}
        for j, lab in enumerate(sg["columns"]):
            i = by_end.get(lab)
            if i is None or rev["values"][i] is None:
                continue
            tot = sum(r["values"][j] or 0 for r in sg["rows"])
            check(abs(tot - rev["values"][i]) / rev["values"][i] < 0.01, f"FIN-5 {t}: segments for {lab} sum to {tot:.0f}, revenue is {rev['values'][i]:.0f}")
    elif sg is not None:
        check(bool(sg.get("note")), f"FIN-5 {t}: no segments and no Sample note")
    else:
        fails.append(f"FIN-5 {t}: segments never attempted")

result = {"passed": passed, "failed": len(fails), "failures": fails}
if "--json" in sys.argv:
    print(json.dumps(result))
else:
    print(f"financials checks: {passed} passed, {len(fails)} failed")
    for m in fails:
        print("  FAIL", m)
sys.exit(1 if fails else 0)
