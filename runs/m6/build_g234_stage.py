"""Staged-only edge files for DASH, CART, TSLA, AMD, INTC, GRAB, TSM, ORCL, APLD from the admin's decisions (2026-10-21)."""
import json, re
items = {i["id"]: i for i in json.load(open("runs/m6/g23_items.json"))}
ver = {x["id"]: x["verdict"] for x in json.load(open("runs/m6/verify_g23/verification_results.json"))}
for x in json.load(open("runs/m6/verify_g23_rerun/verification_results.json")):  # rerun in batches of 3 replaces "no answer"
    ver[x["id"]] = x["verdict"]
V = {(i["focal"], i["source"], i["type"], i["target"]): ver[i["id"]] for i in items.values()}
dash = open("/tmp/dash.txt").read()
def span(a, b):
    i = dash.index(a); return dash[i:dash.index(b, i) + len(b)]
DASHQ = {
 "Wolt": span("The Company granted restricted stock to certain continuing employees in connection with the acquisition of Wolt Enterprises Oy", "May 31, 2022."),
 "SevenRooms": span("On June 13, 2025, the Company completed the acquisition of 100 percent of the outstanding equity interests of SevenRooms Inc.", "(“SevenRooms”)"),
 "Symbiosys": span("On May 28, 2025, the Company acquired Symbiosys Corp.", "offsite advertising capabilities."),
}
S = lambda f, s, t, g: (f, s, t, g)
STAGE_EXTRA = {  # uncertain or failing edges the admin approved
 "DASH": [S("DASH","Amazon","supplies","DASH"), S("DASH","Alphabet","supplies","DASH")],
 "TSLA": [S("TSLA","TSLA","invests","xAI")],
 "AMD": [S("AMD","AMD","competes","Marvell"), S("AMD","AMD","competes","Analog Devices"), S("AMD","AMD","competes","Texas Instruments"),
         S("AMD","AMD","sells_to","Sony"), S("AMD","AMD","sells_to","Microsoft"), S("AMD","AMD","sells_to","Valve"),
         S("AMD","OpenAI","invests","AMD"), S("AMD","AMD","acquires","Silo AI")],
 "INTC": [S("INTC","INTC","competes",n) for n in ("AMD","NVIDIA","Amazon","Alphabet")],
 "GRAB": [S("GRAB","Adyen","supplies","GRAB"), S("GRAB","Stripe","supplies","GRAB"), S("GRAB","GRAB","acquires","Validus Capital"),
          S("GRAB","GRAB","acquires","Stash Financial"), S("GRAB","GRAB","acquires","GrabFin Operations (Malaysia)")],
 "TSM": [S("TSM","TSM","invests","SSMC"), S("TSM","Xintec","supplies","TSM")],
 "APLD": [S("APLD","APLD","sells_to","CoreWeave"), S("APLD","APLD","invests","CoreWeave")],
}
DROP_LABELS = {  # duplicate labels, subsidiaries, financing/audit roles
 "ORCL": {"Oracle Financial Services Software Limited","Oracle Corporation Japan","Ampere"},
 "AMD": {"United Microelectronics Corporation","ZT Group","Sanmina","ATMP JV"},
 "INTC": {"IMS"}, "GRAB": {"PT Super Bank Indonesia Tbk","GXS Bank"}, "TSM": {"Koninklijke Philips","EDB Investment","NXP"},
 "CART": {"Marlin 9 Holdings"},
}
NOTE = {("GRAB","Stash Financial"): "Agreement to acquire; check completion.", ("GOOGL","Wiz"): ""}
RENAME = {"Samsung Electronics": "Samsung"}
out = {}
for T in ["DASH","CART","TSLA","AMD","INTC","GRAB","TSM","ORCL","APLD"]:
    edges = json.load(open(f"runs/m6_resolved/{T.lower()}_extraction.json")); keep = []; extra = set(STAGE_EXTRA.get(T, []))
    for e in edges:
        for k in ("counterparty","source","target"): e[k] = RENAME.get(e[k], e[k])
        key = (T, e["source"], e["type"], e["target"]); other = e["target"] if e["source"] == T else e["source"]
        if other in DROP_LABELS.get(T, set()): continue
        if T == "DASH" and e["type"] == "supplies" and other in ("Bank of America","JPMorgan Chase","KPMG"): continue
        ok = V.get(key) == "pass" or key in extra
        if T == "DASH" and e["type"] == "acquires" and other in DASHQ:
            e["evidence"] = [{"section":"notes","quote":DASHQ[other],"quote_found":True}]; ok = True
        if T == "TSLA" and key == (T,"TSLA","partners","xAI"): ok = False
        if not ok: continue
        ev = [v for v in e["evidence"] if v.get("quote_found")][:3]
        if not ev: continue
        e["evidence"] = ev
        if (T, other) in NOTE and NOTE[(T, other)]: e["note"] = NOTE[(T, other)]
        keep.append(e)
    out[T] = keep; json.dump(keep, open(f"runs/m6/{T.lower()}_stage.json","w"), indent=1)
    print(T, len(keep))
