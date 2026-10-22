"""Annual-report extraction agent for non-SEC reports (M14 London, M15 Hong Kong), batch run with full token and cost logging (RUN-1).

Usage: python3 -I agents/filings_extraction/run_report.py TICKER --name "Vodafone Group" --pdf report.pdf --as-of 2026-03-31
           --doc "Vodafone Annual Report 2026" [--url URL] [--role extractor] [--out DIR] [--workers 3]
       or --html report.html for an HTML report (for example a 20-F saved from EDGAR).

Same rules as run_extraction.py (same prompt, same six link types, same exact-quote requirement). Differences:
* The input is a local PDF or HTML file, not an EDGAR 10-K, so there is no 10-K section split. Each quote records the report page instead ("p12" or "p12-13").
* Model ids come from config/models.yaml by role. Nothing else names a model.
* Every call's usage is written to <out>/<ticker>_run.json. Every quote is checked word for word against the report text.
  Unfound quotes are kept and flagged (EXT-6 counts them).
* Output is a re-run folder (default runs/<role>/). Nothing is written to the database here and nothing is promoted."""
import argparse, concurrent.futures as cf, json, pathlib, re, subprocess, sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(ROOT / "agents" / "common"))
import yaml  # noqa: E402
from claude_cli import call  # noqa: E402
from run_extraction import RULES, SYSTEM, parse, norm  # noqa: E402  (one prompt for every market)

CHUNK = 90_000


def clean(p):
    """One page of raw text to one line. A hyphen at a line break before a lowercase word is joined ("long-\\nterm" -> "long-term")."""
    p = re.sub(r"\s*\n\s*", " ", p)
    return re.sub(r"(?<=[a-z])- (?=[a-z])", "-", p).strip()


def pages_from_pdf(path):
    raw = subprocess.run(["pdftotext", str(path), "-"], capture_output=True, text=True, check=True).stdout
    return [clean(p) for p in raw.split("\f")]


def pages_from_html(path):
    import html
    t = open(path, encoding="utf-8", errors="replace").read()
    t = re.sub(r"(?is)<(script|style).*?</\1>", "", t)
    t = re.sub(r"(?i)<br\s*/?>|</p>|</div>|</tr>", "\n", t)
    t = html.unescape(re.sub(r"<[^>]+>", " ", t)).replace("\xa0", " ")
    # An HTML filing has no page breaks. Cut it into blocks of about 6,000 characters so a quote can still be located ("blk12").
    t = clean(t)
    return [t[i:i + 6000] for i in range(0, len(t), 6000)]


def chunk_pages(pages, label):
    """Group whole pages into chunks of about CHUNK characters. Page markers help the model stay inside one page."""
    out, cur, n = [], "", 0
    for i, p in enumerate(pages, 1):
        if not p:
            continue
        piece = f"\n=== {label} {i} ===\n{p}\n"
        if cur and len(cur) + len(piece) > CHUNK:
            out.append(cur); cur = ""
        cur += piece
    return out + ([cur] if cur.strip() else [])


def locate(quote, pages, full, label):
    """Page (or pages) holding the quote. Empty if the quote is not in the text."""
    nq = norm(quote)
    for i, p in enumerate(pages, 1):
        if nq in norm(p):
            return f"{label}{i}"
    # a quote that runs over a page break
    for i in range(len(pages) - 1):
        if nq in norm(pages[i] + " " + pages[i + 1]):
            return f"{label}{i + 1}-{i + 2}"
    return "unlocated" if nq in full else ""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ticker"); ap.add_argument("--name", required=True)
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--pdf"); src.add_argument("--html")
    ap.add_argument("--as-of", required=True, help="period end of the report, YYYY-MM-DD")
    ap.add_argument("--doc", required=True, help="document title shown with the evidence")
    ap.add_argument("--url", default=None); ap.add_argument("--role", default="extractor")
    ap.add_argument("--out"); ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--max-chunks", type=int, default=0, help="test runs only")
    a = ap.parse_args()
    cfg = yaml.safe_load(open(ROOT / "config" / "models.yaml"))
    model = cfg["roles"][a.role]["model"]
    t = a.ticker.upper()
    label = "p" if a.pdf else "blk"
    pages = pages_from_pdf(a.pdf) if a.pdf else pages_from_html(a.html)
    full = norm(" ".join(pages))
    parts = chunk_pages(pages, "page" if a.pdf else "block")
    if a.max_chunks:
        parts = parts[:a.max_chunks]
    out_dir = pathlib.Path(a.out or ROOT / "runs" / a.role); out_dir.mkdir(parents=True, exist_ok=True)
    extra = ("Quotes must not include the '=== page N ===' marker lines and must stay inside one page when possible. "
             "The company reports in its own annual report, so a customer, supplier or partner may be named only once; read the notes and the strategic report alike.")

    def one(i_ch):
        i, ch = i_ch
        prompt = f"Focal company: {a.name} (ticker {t}). Document: {a.doc}, part {i} of {len(parts)}.\n\n{RULES}\n{extra}\n\n--- REPORT TEXT ---\n{ch}"
        res, info = call(model, prompt, SYSTEM)
        info["chunk"] = i
        try:
            items = parse(res)
        except Exception as ex:  # keep the failure visible
            items, info["parse_error"] = [], str(ex)[:200]
        print(f"chunk {i}/{len(parts)}: {len(items)} items, in={info['input_tokens']+info['cache_creation_tokens']+info['cache_read_tokens']} out={info['output_tokens']} ${info['cost_usd']:.4f} {info['seconds']}s", flush=True)
        return info, items

    with cf.ThreadPoolExecutor(max_workers=a.workers) as ex:
        results = list(ex.map(one, enumerate(parts, 1)))
    calls = [r[0] for r in results]; raw = [it for r in results for it in r[1]]
    merged = {}
    for it in raw:
        try:
            typ, cp = it["type"], it["counterparty"].strip()
            s, g = it["source"], it["target"]
        except Exception:
            continue
        k = (cp.lower(), typ, str(s).lower(), str(g).lower())
        m = merged.setdefault(k, {"counterparty": cp, "entity_type": it.get("entity_type") or "other", "type": typ, "source": s, "target": g,
                                  "evidence": [], "document_url": a.url, "document": a.doc, "as_of": a.as_of,
                                  "exposure_pct": it.get("exposure_pct"), "exposure_qualifier": it.get("exposure_qualifier")})
        for q in it.get("quotes", []):
            if q and q not in [v["quote"] for v in m["evidence"]]:
                found = norm(q) in full
                m["evidence"].append({"section": locate(q, pages, full, label) if found else "", "quote": q, "quote_found": found})
    edges = list(merged.values())
    json.dump(edges, open(out_dir / f"{t.lower()}_extraction.json", "w"), ensure_ascii=False, indent=1)
    tot = {k: sum(c[k] for c in calls) for k in ("input_tokens", "cache_creation_tokens", "cache_read_tokens", "output_tokens", "cost_usd", "seconds")}
    json.dump({"ticker": t, "role": a.role, "model": model, "document": a.doc, "as_of": a.as_of, "chunks": len(parts), "calls": calls, "totals": tot,
               "edges": len(edges), "quotes_not_found": sum(not v["quote_found"] for e in edges for v in e["evidence"])},
              open(out_dir / f"{t.lower()}_run.json", "w"), indent=1)
    print(f"{t} {a.role} ({model}): {len(edges)} edges, tokens in={tot['input_tokens']+tot['cache_creation_tokens']+tot['cache_read_tokens']} out={tot['output_tokens']} cost=${tot['cost_usd']:.4f}")


if __name__ == "__main__":
    main()
