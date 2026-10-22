"""Geographic revenue extraction (M16): where a company earns its revenue, by country or named region, as the report states it.

Usage: python3 -I agents/filings_extraction/run_geo.py TICKER --name "Vodafone Group" --pdf report.pdf --as-of 2026-03-31
           --doc "Vodafone Annual Report 2026" [--role extractor] [--out DIR] [--top 8]
       or --html report.html.

Rules (no estimates, labelled gaps):
* Only a revenue table or sentence that the report itself gives. If there is none, the output has zero rows and says so. Nothing is inferred.
* Only the latest fiscal year. Revenue only (not assets, tax, profit or employees).
* A percentage is stored only if the report states it. A percentage may be computed (amount / stated total) when the report states a total
  and the rows add up to it within 2%. It is labelled `computed`.
* A country maps through country_region (see db/migrations/0010_m16_regions.sql). A named bucket ("Rest of world", "Other Europe") stays a bucket.
* Every quote is checked word for word against the report text. Unfound quotes are kept and flagged.
* Output goes to a run folder. Nothing is written to the database here. Rows are staged by make_geo_sql.py, and promotion is an admin command."""
import argparse, json, pathlib, re, sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE)); sys.path.insert(0, str(ROOT / "agents" / "common"))
import yaml  # noqa: E402
from claude_cli import call  # noqa: E402
from run_extraction import norm  # noqa: E402
from run_report import pages_from_pdf, pages_from_html  # noqa: E402

SYSTEM = "You extract revenue by country or region from company reports for a market-data product. You output JSON only."
SYN = {"türkiye": "TR", "turkiye": "TR", "uk": "GB", "u.k.": "GB", "usa": "US", "u.s.": "US", "mainland china": "CN", "prc": "CN",
       "republic of ireland": "IE", "korea": "KR", "czech republic": "CZ"}
REGIONS = ["North America", "Latin America", "Europe", "MENA", "Sub-Saharan Africa", "APAC"]


def countries():
    sql = (ROOT / "db" / "migrations" / "0010_m16_regions.sql").read_text()
    m = {n.lower(): c for c, n in re.findall(r"\('([A-Z]{2})','([^']+)','[^']+'\)", sql)}
    m.update(SYN)
    return m


def pick_pages(pages, cmap, top):
    """Pages that look like a revenue-by-geography table: the word revenue or sales and several distinct country names."""
    scored = []
    for i, p in enumerate(pages, 1):
        low = p.lower()
        if not re.search(r"\b(revenue|sales)\b", low):
            continue
        found = {c for n, c in cmap.items() if re.search(r"(?<![a-z])" + re.escape(n) + r"(?![a-z])", low)}
        if len(found) >= 3:
            scored.append((len(found) + min(low.count("revenue"), 10) / 5, i))
    keep = sorted(i for _, i in sorted(scored, reverse=True)[:top])
    return keep


PROMPT = """Focal company: {name} (ticker {t}). Document: {doc}.

Task: find the report's own revenue by country, market or geographic region for the LATEST fiscal year (period ending {asof}). Use only what the text below states.
Return one JSON object: {{"rows":[...], "total":{{...}} or null, "note":"short text"}}.
Each row: {{"label": the name exactly as the report prints it, "country": two-letter ISO code if the label is one single country, else null,
"bucket_region": one of {regions} only if the label is a named bucket that sits wholly inside one region (for example "Other Europe"), else null,
"revenue_amount": number as printed (no thousands separators), "unit": "m" or "bn" as printed or null, "currency": three-letter code or null,
"revenue_pct": a percentage ONLY if the text prints one for this row, else null, "page": the number in the nearest === page N === marker,
"quote": the table row or sentence copied character for character from the text (if the row is split in the text, copy the label and its latest-year figure together as they appear)}}.
"total": {{"revenue_amount": the report's stated total revenue for the same table, "quote": copied exactly, "page": N}} or null.
Rules:
1. Revenue only. Not assets, tax, profit, employees, customers or subscribers.
2. Only the latest fiscal year column. Skip prior years, eliminations, "total" lines (those go in "total"), and sub-lines of a country already listed.
3. A bucket such as "Rest of world", "Other" or "Africa" is a row with country null (give bucket_region only if the rule above holds).
4. Do not estimate or fill gaps. If the text has no revenue-by-geography figures, return {{"rows":[],"total":null,"note":"no geographic revenue table found"}}.
5. If revenue is reported per segment name (for example a business unit) and not per country, return no rows and say so in "note".

--- REPORT TEXT ---
{text}"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ticker"); ap.add_argument("--name", required=True)
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--pdf"); src.add_argument("--html")
    ap.add_argument("--as-of", required=True); ap.add_argument("--doc", required=True)
    ap.add_argument("--role", default="extractor"); ap.add_argument("--out"); ap.add_argument("--top", type=int, default=8)
    a = ap.parse_args()
    model = yaml.safe_load(open(ROOT / "config" / "models.yaml"))["roles"][a.role]["model"]
    t = a.ticker.upper()
    pages = pages_from_pdf(a.pdf) if a.pdf else pages_from_html(a.html)
    full = norm(" ".join(pages))
    cmap = countries()
    keep = pick_pages(pages, cmap, a.top)
    out_dir = pathlib.Path(a.out or ROOT / "runs" / "m16"); out_dir.mkdir(parents=True, exist_ok=True)
    if not keep:
        res = {"ticker": t, "rows": [], "total": None, "note": "no page looks like a revenue-by-country table", "pages_sent": []}
        json.dump(res, open(out_dir / f"{t.lower()}_geo.json", "w"), indent=1)
        print(f"{t}: no candidate pages"); return
    text = "\n".join(f"\n=== page {i} ===\n{pages[i - 1]}\n" for i in keep)
    raw, info = call(model, PROMPT.format(name=a.name, t=t, doc=a.doc, asof=a.as_of, regions=REGIONS, text=text), SYSTEM)
    s, e = raw.find("{"), raw.rfind("}")
    try:
        j = json.loads(raw[s:e + 1])
    except Exception as ex:
        j = {"rows": [], "total": None, "note": f"parse error: {str(ex)[:120]}"}
    rows = []
    for r in j.get("rows", []):
        q = r.get("quote") or ""
        r["quote_found"] = bool(q) and norm(q) in full
        r["period_end"] = a.as_of
        c = r.get("country")
        if c and c not in set(cmap.values()):
            r["country"] = None; r["note"] = f"country code {c} not in country_region"
        if r.get("bucket_region") not in REGIONS:
            r["bucket_region"] = None
        # the figure must appear on the page the model cites
        pg = r.get("page"); amt = r.get("revenue_amount")
        r["amount_on_page"] = bool(pg and amt is not None and isinstance(pg, int) and 1 <= pg <= len(pages) and
                                   re.search(r"(?<![\d.])" + re.escape(f"{amt:,}".rstrip("0").rstrip(".") if isinstance(amt, float) else f"{amt:,}") + r"(?![\d])", pages[pg - 1]))
        r["pct_basis"] = "stated" if r.get("revenue_pct") is not None else None
        rows.append(r)
    tot = j.get("total")
    if tot and tot.get("revenue_amount"):
        tot["quote_found"] = norm(tot.get("quote") or "") in full
        s_amt = sum(r["revenue_amount"] for r in rows if isinstance(r.get("revenue_amount"), (int, float)))
        tot["rows_sum"] = s_amt
        # rows may add to less than the total (central or unallocated lines are not geographies), never to more
        tot["rows_add_up"] = s_amt <= 1.02 * tot["revenue_amount"] and tot["quote_found"]
        tot["share_of_total_rows"] = round(100 * s_amt / tot["revenue_amount"], 1)
        if tot["rows_add_up"]:
            for r in rows:
                if r.get("revenue_pct") is None and isinstance(r.get("revenue_amount"), (int, float)):
                    r["revenue_pct"] = round(100 * r["revenue_amount"] / tot["revenue_amount"], 2); r["pct_basis"] = "computed"
    res = {"ticker": t, "document": a.doc, "as_of": a.as_of, "role": a.role, "model": model, "pages_sent": keep, "rows": rows, "total": tot,
           "note": j.get("note"), "usage": info,
           "quotes_not_found": sum(not r["quote_found"] for r in rows), "amounts_not_on_page": sum(not r["amount_on_page"] for r in rows)}
    json.dump(res, open(out_dir / f"{t.lower()}_geo.json", "w"), ensure_ascii=False, indent=1)
    print(f"{t}: {len(rows)} rows from pages {keep}; total={'yes' if tot else 'no'}; quotes not found={res['quotes_not_found']}; "
          f"amounts not on page={res['amounts_not_on_page']}; in={info['input_tokens']+info['cache_creation_tokens']+info['cache_read_tokens']} "
          f"out={info['output_tokens']} ${info['cost_usd']:.4f}")


if __name__ == "__main__":
    main()
