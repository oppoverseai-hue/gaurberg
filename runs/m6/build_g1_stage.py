"""Build staged-only edge files for group 1 from the admin's decisions (2026-10-21). No database writes here."""
import json, re, urllib.request, warnings, pickle
from bs4 import BeautifulSoup
warnings.filterwarnings("ignore")
UA = {"User-Agent": "Gaurberg abhishek.g16@fms.edu"}
def get(u): return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60).read().decode("utf8", "ignore")
def norm(h): return re.sub(r"\s+", " ", BeautifulSoup(h, "lxml").get_text(" "))
T = pickle.load(open("/tmp/docs.pkl", "rb"))
sub = json.loads(get("https://data.sec.gov/submissions/CIK0001018724.json"))["filings"]["recent"]
k = next(j for j, f in enumerate(sub["form"]) if f == "10-K")
AMZN_URL = f"https://www.sec.gov/Archives/edgar/data/1018724/{sub['accessionNumber'][k].replace('-','')}/{sub['primaryDocument'][k]}"
T["AMZN"] = norm(get(AMZN_URL)); filed = {"AMZN": sub["filingDate"][k]}
c = json.loads(get("https://data.sec.gov/submissions/CIK0002021728.json"))["filings"]["recent"]
filed["CBRS"] = c["filingDate"][next(j for j, f in enumerate(c["form"]) if f == "424B4")]
filed.update({"NVDA": "2026-02-25", "GOOGL": "2026-02-05", "MSFT": "2026-07-29"})

def span(doc, start, end):
    s = T[doc]; i = s.index(start); j = s.index(end, i) + len(end); return s[i:j]
NV_INTRO = span("NVDA", "Our current competitors include:", "Our current competitors include:")
NV_CLOUD = span("NVDA", "large cloud services companies with internal teams", "and Microsoft Corporation, or Microsoft;")
NV_SOC = span("NVDA", "suppliers of hardware and software for SoC products", "such as Tesla, Inc.;")
CB_COMP = span("CBRS", "With respect to hardware, we compete against semiconductor companies such as NVIDIA Corporation", "private companies.")
AM_INV = span("AMZN", "which primarily reflect investments in convertible notes from Anthropic", "we invested in 2025.")
for d, q in [("NVDA", NV_INTRO), ("NVDA", NV_CLOUD), ("NVDA", NV_SOC), ("CBRS", CB_COMP), ("AMZN", AM_INV)]: assert q in T[d]

items = {i["id"]: i for i in json.load(open("runs/m6/g1_items.json"))}
ver = {x["id"]: x["verdict"] for x in json.load(open("runs/m6/verify_g1/verification_results.json"))}
verd = {(i["focal"], i["source"], i["type"], i["target"]): ver[i["id"]] for i in items.values()}
STAGE_U = {("NVDA","Hon Hai","supplies","NVDA"), ("GOOGL","GOOGL","acquires","Wiz"), ("GOOGL","GOOGL","acquires","Intersect"),
           ("CBRS","CBRS","partners","Amazon"), ("CBRS","OpenAI","invests","CBRS"), ("AMZN","AMZN","invests","Anthropic")}
FIX = {("NVDA","NVDA","competes",n): ([NV_INTRO, NV_CLOUD] if n in ("Baidu","Microsoft") else [NV_INTRO, NV_SOC]) for n in ("Baidu","Microsoft","Ambarella","Broadcom","Qualcomm")}
FIX[("CBRS","CBRS","competes","NVIDIA")] = [CB_COMP]
FIX[("AMZN","AMZN","invests","Anthropic")] = [AM_INV]
NOTE = {"Wiz": "Announced, not completed (definitive agreement March 2025).", "Intersect": "Announced, not completed (definitive agreement December 2025)."}
out = {}
for t in ["nvda", "amzn", "googl", "msft", "cbrs"]:
    T_ = t.upper(); edges = json.load(open(f"runs/m6_resolved/{t}_extraction.json")); keep = []
    for e in edges:
        key = (T_, e["source"], e["type"], e["target"])
        if key not in verd: continue
        if verd[key] != "pass" and key not in STAGE_U and key not in FIX: continue
        if key in FIX:
            e["evidence"] = [{"section": "business" if T_ != "AMZN" else "mdna", "quote": q, "quote_found": True} for q in FIX[key]]
        else:
            e["evidence"] = [v for v in e["evidence"] if v.get("quote_found")]
        if key[3] in NOTE and T_ == "GOOGL": e["note"] = NOTE[key[3]]
        if e["evidence"]: keep.append(e)
    # AMZN doc url for repaired quote
    for e in keep:
        if T_ == "AMZN": e["document_url"] = AMZN_URL
    out[T_] = keep
    json.dump(keep, open(f"runs/m6/{t}_stage.json", "w"), indent=1)
    print(T_, len(keep), "staged edges; filed", filed[T_])
json.dump(filed, open("runs/m6/g1_filed.json", "w"))
