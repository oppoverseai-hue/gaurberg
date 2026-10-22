"""Adds segment revenue to app/data/financials/<TICKER>.json from each company's latest 10-K (inline XBRL).

Reads only facts the filer tagged: revenue broken out by the business-segment axis (or, if the filer has no segment axis,
the product/service axis). Nothing is estimated. If the 10-K has no such breakdown the company gets a note and shows Sample.
Usage: python3 app/scripts/save_segments.py [TICKER ...]
"""
import json, re, sys, time, urllib.request
from pathlib import Path
from bs4 import BeautifulSoup

UA = "Gaurberg research abhishek.g16@fms.edu"
DATA = Path(__file__).resolve().parent.parent / "data" / "financials"
REV = {"us-gaap:Revenues", "us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax", "us-gaap:RevenueFromContractWithCustomerIncludingAssessedTax", "us-gaap:SalesRevenueNet"}
AXES = ["us-gaap:StatementBusinessSegmentsAxis", "srt:ProductOrServiceAxis", "us-gaap:ProductOrServiceAxis"]


def get(url):
    time.sleep(0.2)
    return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=90).read()


def days(a, b):
    from datetime import date
    y1, m1, d1 = map(int, a.split("-")); y2, m2, d2 = map(int, b.split("-"))
    return (date(y2, m2, d2) - date(y1, m1, d1)).days


def segments_for(cik):
    sub = json.loads(get(f"https://data.sec.gov/submissions/CIK{int(cik):010d}.json"))["filings"]["recent"]
    i = next(i for i, f in enumerate(sub["form"]) if f == "10-K")
    acc, doc = sub["accessionNumber"][i], sub["primaryDocument"][i]
    url = f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc.replace('-', '')}/{doc}"
    soup = BeautifulSoup(get(url), "lxml")
    ctx = {}
    for c in soup.find_all("xbrli:context"):
        mem = c.find_all("xbrldi:explicitmember")
        per = c.find("xbrli:period")
        s, e = per.find("xbrli:startdate"), per.find("xbrli:enddate")
        # A segment fact often carries a second dimension that only says "operating segment"; ignore that one.
        main = [m for m in mem if not (m["dimension"] == "srt:ConsolidationItemsAxis" and m.text.strip() == "us-gaap:OperatingSegmentsMember")]
        if len(main) == 1 and s and e and 340 < days(s.text.strip(), e.text.strip()) < 380:
            ctx[c["id"]] = (main[0]["dimension"], main[0].text.strip(), e.text.strip())
    for axis in AXES:
        got = {}
        for f in soup.find_all("ix:nonfraction"):
            if f.get("name") not in REV or f.get("contextref") not in ctx or f.get("xsi:nil"):
                continue
            ax, member, end = ctx[f["contextref"]]
            if ax != axis:
                continue
            try:
                v = float(f.text.replace(",", "").strip() or "nan") * 10 ** int(f.get("scale", "0"))
            except ValueError:
                continue
            if f.get("sign") == "-":
                v = -v
            got[(member, end)] = v / 1e6
        if got:
            ends = sorted({e for _, e in got})[-3:]
            members = sorted({m for m, e in got if e in ends}, key=lambda m: -(got.get((m, ends[-1])) or 0))
            rows = [{"label": re.sub(r"(?<=[a-z])(?=[A-Z])", " ", m.split(":")[-1].removesuffix("Member")), "values": [round(got[(m, e)], 0) if (m, e) in got else None for e in ends], "fmt": "usd", "subs": []} for m in members]
            return {"measure": "Revenue by segment" if axis.endswith("StatementBusinessSegmentsAxis") else "Revenue by product or service", "columns": [f"FY {e[:7]}" for e in ends], "rows": rows,
                    "note": f"From the latest 10-K ({url.split('/')[-1]}), tagged revenue by {'business segment' if 'Segments' in axis else 'product or service'}. Names come from the filer's own tags; segments may not add to total revenue because of eliminations or untagged lines."}
    return None


if __name__ == "__main__":
    for p in sorted(DATA.glob("*.json")):
        t = p.stem
        if len(sys.argv) > 1 and t not in sys.argv[1:]:
            continue
        d = json.loads(p.read_text())
        if d.get("status") != "ok":
            continue
        try:
            seg = segments_for(d["cik"])
            d["segments"] = seg or {"measure": "", "columns": [], "rows": [], "note": "the latest 10-K has no revenue tagged by segment or product."}
            if seg:  # validate before showing: tagged segments must add up to total revenue for each year (within 1%)
                rev = d["is"][0]["values"]; idx = {c["label"]: i for i, c in enumerate(d["columns"])}
                bad = [lab for j, lab in enumerate(seg["columns"]) if lab in idx and rev[idx[lab]] and abs(sum(r["values"][j] or 0 for r in seg["rows"]) - rev[idx[lab]]) / rev[idx[lab]] >= 0.01]
                if bad:
                    d["segments"] = {"measure": "", "columns": [], "rows": [], "note": f"the 10-K's tagged segments do not add up to total revenue ({', '.join(bad)}), usually because members overlap or a line is untagged, so they are not shown."}
        except Exception as e:  # keep going; a failed company shows Sample, never made-up numbers
            d["segments"] = {"measure": "", "columns": [], "rows": [], "note": f"segment data could not be read from the 10-K ({type(e).__name__})."}
        p.write_text(json.dumps(d))
        print(t, len(d["segments"]["rows"]), d["segments"]["measure"])
