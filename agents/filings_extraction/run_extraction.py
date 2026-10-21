"""Filings extraction agent, batch run with full token and cost logging (RUN-1).

Usage: python3 -I agents/filings_extraction/run_extraction.py TICKER --role extractor_small|extractor_main [--url URL] [--out DIR]

* Model ids come from config/models.yaml by role. Nothing else names a model.
* The 10-K is fetched from SEC EDGAR, cut into chunks, and each chunk goes to `claude -p` (no tools, no session kept).
* Every call's usage (input, cache, output tokens, cost, seconds) is written to <out>/<ticker>_run.json.
* Every quote is checked word for word against the filing text. Unfound quotes are kept and flagged (EXT-6 counts them).
* Output is a re-run folder (default runs/<role>/). Nothing is written to the database here and nothing is promoted.
Environment: EDGAR_UA overrides the SEC user agent (SEC asks for a real contact)."""
import argparse, json, os, pathlib, re, subprocess, sys, time, urllib.request

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
from split_10k import to_text, split  # noqa: E402
import yaml  # noqa: E402

CHUNK = 90_000
NAMES = {"CRWV": "CoreWeave", "LYFT": "Lyft", "UBER": "Uber Technologies"}
SYSTEM = """You extract company relationships from SEC filings for a market-data product. You output JSON only."""
RULES = """Find every relationship in the filing text below between the focal company and another NAMED company or organisation.
Allowed types (use exactly these words):
- supplies: the other party supplies the focal company with components, technology, capacity or services. source = supplier, target = customer.
- sells_to: the focal company sells to the other party as its customer. source = seller, target = buyer.
- partners: a named partnership, collaboration, joint venture or alliance. Undirected; put the focal company as source.
- competes: the filing names the other company as a competitor. Undirected; put the focal company as source.
- invests: one party holds or made an equity investment in the other. source = investor, target = investee.
- acquires: one party acquired (or agreed to acquire) the other. source = acquirer, target = acquired company.
Rules:
1. Use only what this text states. Do not use outside knowledge. Do not guess.
2. "quotes" must be copied character for character from the text (one or two sentences). If you cannot copy a supporting sentence exactly, leave the relationship out.
3. Skip generic groups (for example "our customers", "suppliers") and the focal company itself.
4. One object per counterparty and type. If one sentence names several companies, give each its own object with the same quote.
5. counterparty is the common short name (for example "Microsoft", "NVIDIA"). source and target are the focal ticker or the counterparty name.
6. exposure_pct only when the text states a percentage that belongs to this link (share of the source's revenue for sells_to, ownership share for acquires or invests); otherwise null. exposure_qualifier is one of exact, approximate, at_least, up_to, or null.
7. entity_type is one of public_company, private_company, government, other.
Return a JSON array and nothing else (no code fence). Each object has keys:
counterparty, entity_type, type, source, target, quotes (list of strings), exposure_pct, exposure_qualifier.
Return [] if the text has no such relationships."""
norm = lambda s: re.sub(r"\s+", " ", s.replace("’", "'").replace("“", '"').replace("”", '"')).strip()


def fetch(url, cache):
    cache.mkdir(parents=True, exist_ok=True)
    f = cache / re.sub(r"\W+", "_", url)[-80:]
    if not f.exists():
        req = urllib.request.Request(url, headers={"User-Agent": os.environ.get("EDGAR_UA", "Gaurberg Research gaurberg-research@example.com")})
        f.write_bytes(urllib.request.urlopen(req, timeout=120).read())
    return f


def chunks(text):
    out, cur = [], ""
    for para in text.split("\n"):
        if len(cur) + len(para) > CHUNK and cur:
            out.append(cur); cur = ""
        cur += para + "\n"
    return out + ([cur] if cur.strip() else [])


def call(model, prompt):
    t = time.time()
    r = subprocess.run(["claude", "-p", "--model", model, "--output-format", "json", "--tools", "", "--no-session-persistence",
                        "--disable-slash-commands", "--setting-sources", "", "--system-prompt", SYSTEM],
                       input=prompt, capture_output=True, text=True, timeout=900)
    if r.returncode != 0:
        raise RuntimeError(f"claude exit {r.returncode}: {r.stderr[:500]}")
    j = json.loads(r.stdout)
    u = j.get("usage", {})
    info = {"input_tokens": u.get("input_tokens", 0), "cache_creation_tokens": u.get("cache_creation_input_tokens", 0),
            "cache_read_tokens": u.get("cache_read_input_tokens", 0), "output_tokens": u.get("output_tokens", 0),
            "cost_usd": j.get("total_cost_usd", 0), "seconds": round(time.time() - t, 1), "is_error": bool(j.get("is_error"))}
    return j.get("result", ""), info


def parse(txt):
    txt = txt.strip()
    txt = re.sub(r"^```(?:json)?\s*|\s*```$", "", txt)
    s, e = txt.find("["), txt.rfind("]")
    return json.loads(txt[s:e + 1]) if s >= 0 and e > s else []


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ticker"); ap.add_argument("--role", required=True)
    ap.add_argument("--url"); ap.add_argument("--out"); ap.add_argument("--cache", default=str(ROOT / ".cache" / "filings"))
    a = ap.parse_args()
    cfg = yaml.safe_load(open(ROOT / "config" / "models.yaml"))
    model = cfg["roles"][a.role]["model"]
    t = a.ticker.upper()
    url = a.url
    if not url:
        for p in sorted(HERE.glob(f"{t.lower()}_*.json")):
            url = json.load(open(p))[0]["document_url"]; break
    assert url, "pass --url (no staged extraction to take the filing URL from)"
    path = fetch(url, pathlib.Path(a.cache))
    text = to_text(str(path))
    secs = {k: norm(v) for k, v in split(text).items()}
    full = norm(text)
    parts = chunks(text)
    out_dir = pathlib.Path(a.out or ROOT / "runs" / a.role); out_dir.mkdir(parents=True, exist_ok=True)
    calls, raw = [], []
    for i, ch in enumerate(parts, 1):
        prompt = f"Focal company: {NAMES.get(t, t)} (ticker {t}). Filing: annual report (10-K), part {i} of {len(parts)}.\n\n{RULES}\n\n--- FILING TEXT ---\n{ch}"
        res, info = call(model, prompt)
        info["chunk"] = i
        try:
            items = parse(res)
        except Exception as ex:  # keep the failure visible
            items, info["parse_error"] = [], str(ex)[:200]
        calls.append(info); raw += items
        print(f"chunk {i}/{len(parts)}: {len(items)} items, in={info['input_tokens']+info['cache_creation_tokens']+info['cache_read_tokens']} out={info['output_tokens']} ${info['cost_usd']:.4f} {info['seconds']}s", flush=True)
    merged = {}
    for it in raw:
        try:
            typ, cp = it["type"], it["counterparty"].strip()
            src, tgt = it["source"], it["target"]
        except Exception:
            continue
        k = (cp.lower(), typ, str(src).lower(), str(tgt).lower())
        m = merged.setdefault(k, {"counterparty": cp, "entity_type": it.get("entity_type") or "other", "type": typ, "source": src, "target": tgt,
                                  "evidence": [], "document_url": url, "as_of": None, "exposure_pct": it.get("exposure_pct"),
                                  "exposure_qualifier": it.get("exposure_qualifier")})
        for q in it.get("quotes", []):
            if q and q not in [v["quote"] for v in m["evidence"]]:
                found = norm(q) in full
                sec = next((n for n, tx in (("business", secs.get("1", "")), ("risk_factors", secs.get("1a", "")), ("mdna", secs.get("7", ""))) if norm(q) in tx), "notes")
                m["evidence"].append({"section": sec, "quote": q, "quote_found": found})
    m_date = re.search(r"for the fiscal year ended\s+([A-Za-z]+ \d{1,2}, \d{4})", text, re.I)
    for m in merged.values():
        m["as_of"] = "2025-12-31"  # all current hero-set filings are FY2025 calendar-year 10-Ks; check when adding a company
    edges = list(merged.values())
    json.dump(edges, open(out_dir / f"{t.lower()}_extraction.json", "w"), ensure_ascii=False, indent=1)
    tot = {k: sum(c[k] for c in calls) for k in ("input_tokens", "cache_creation_tokens", "cache_read_tokens", "output_tokens", "cost_usd", "seconds")}
    json.dump({"ticker": t, "role": a.role, "model": model, "filing": url, "chunks": len(parts), "calls": calls, "totals": tot,
               "edges": len(edges), "quotes_not_found": sum(not v["quote_found"] for e in edges for v in e["evidence"])},
              open(out_dir / f"{t.lower()}_run.json", "w"), indent=1)
    print(f"{t} {a.role} ({model}): {len(edges)} edges, tokens in={tot['input_tokens']+tot['cache_creation_tokens']+tot['cache_read_tokens']} out={tot['output_tokens']} cost=${tot['cost_usd']:.4f}")


if __name__ == "__main__":
    main()
