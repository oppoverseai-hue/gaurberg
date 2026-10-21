"""M6 batch driver: for each ticker, find the latest annual filing on EDGAR, then run extraction and entity resolution, ONE company at a time.
Writes extraction/resolved files only (no database writes). Usage: batch_m6.py NVDA AMZN ..."""
import json, subprocess, sys, urllib.request
UA = {"User-Agent": "Gaurberg abhishek.g16@fms.edu"}
def get(u): return json.load(urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=30))
tick = get("https://www.sec.gov/files/company_tickers.json")
cik = {v["ticker"]: v["cik_str"] for v in tick.values()}
for t in sys.argv[1:]:
    try:
        c = cik[t if t != "GOOGL" else "GOOGL"]
        s = get(f"https://data.sec.gov/submissions/CIK{c:010d}.json")["filings"]["recent"]
        i = next(k for k, f in enumerate(s["form"]) if f in ("10-K", "20-F"))
        url = f"https://www.sec.gov/Archives/edgar/data/{c}/{s['accessionNumber'][i].replace('-','')}/{s['primaryDocument'][i]}"
        print(f"== {t} {s['form'][i]} filed {s['filingDate'][i]} {url}", flush=True)
        subprocess.run([sys.executable, "agents/filings_extraction/run_extraction.py", t, "--role", "extractor", "--url", url, "--out", "runs/m6"], check=True)
        subprocess.run([sys.executable, "agents/entity_resolution/resolve.py", t, "--in", "runs/m6", "--out", "runs/m6_resolved"], check=True)
    except Exception as e:
        print(f"!! {t} failed: {e}", flush=True)
