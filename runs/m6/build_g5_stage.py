"""Staged-only edge files for META, AAPL, PLTR, NET, LCID (admin: 'stage others too', 2026-10-21). Pass verdicts only; duplicates/vehicles dropped."""
import json
items = {i["id"]: i for i in json.load(open("runs/m6/g23_items.json"))}
ver = {}
for p in ("verify_g23", "verify_g23_rerun"):
    for x in json.load(open(f"runs/m6/{p}/verification_results.json")): ver[x["id"]] = x["verdict"]
V = {(i["focal"], i["source"], i["type"], i["target"]): ver[i["id"]] for i in items.values()}
DROP = {"LCID": {"Ayar Third Investment Company", "Ayar", "SMB Holding Corporation", "SMB", "Government of the Kingdom of Saudi Arabia"}}  # PIF vehicles and duplicate government label
for T in ["META", "AAPL", "PLTR", "NET", "LCID"]:
    keep = []
    for e in json.load(open(f"runs/m6_resolved/{T.lower()}_extraction.json")):
        other = e["target"] if e["source"] == T else e["source"]
        if other in DROP.get(T, set()) or V.get((T, e["source"], e["type"], e["target"])) != "pass": continue
        ev = [v for v in e["evidence"] if v.get("quote_found")][:3]
        if not ev: continue
        e["evidence"] = ev; keep.append(e)
    json.dump(keep, open(f"runs/m6/{T.lower()}_stage.json", "w"), indent=1)
    print(T, len(keep), [(e["source"], e["type"], e["target"], e.get("entity_type")) for e in keep])
