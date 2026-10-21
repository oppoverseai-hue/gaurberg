"""Verification agent (agent 4 of 5). Checks each staged edge against its own quote.

Usage: python3 -I agents/verification/verify.py --in items.json --out DIR --role verifier_baseline [--batch 13] [--only TICKER]
  items.json = list of {id, focal, counterparty, type, source, target, quote, quote_found}  (the seeded-error set, or staged edges flattened)
Checks per edge (verification_results.check_name):
  quote_present  - free and exact: the quote was found word for word in the filing (carried in as quote_found)
  supports_claim, direction, type - one model call per batch of edges, JSON out
Verdict: pass | fail | uncertain. The model never sees any label about planted errors.
The verifier model comes from config/models.yaml by role. VER-3 (different vendor from the extractor) is checked by score_verification.py.
Output: DIR/verification_results.json (one row per edge) and DIR/verification_run.json (tokens and cost per call)."""
import argparse, json, pathlib, re, sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / "agents" / "common"))
from claude_cli import call  # noqa: E402
import yaml  # noqa: E402

SYSTEM = "You are a strict fact-checker for a market-data product. You output JSON only."
RULES = """Each item is one claimed relationship between two organisations, with the sentence from an SEC filing it was taken from.
Link types: supplies (source supplies the target), sells_to (source sells to the target as customer), partners (named partnership or collaboration, undirected),
competes (the filing names them as competitors, undirected), invests (source holds or made an equity investment in the target), acquires (source acquired the target).
For each item decide, using ONLY the sentence given:
- supports_claim: does the sentence actually state a relationship between these two organisations? (false if it is about other companies or says nothing about them)
- direction: for supplies, sells_to, invests and acquires, is the source/target order right? (true for partners and competes)
- type: is the link type the best one for what the sentence says?
verdict = "pass" if all three are true; "fail" if the sentence does not support the claim, or the direction or type is clearly wrong; "uncertain" if the sentence is ambiguous.
Return a JSON array, nothing else, one object per item in the same order: {"id", "supports_claim", "direction", "type", "verdict", "reason"} (reason under 20 words)."""


def parse(txt):
    txt = re.sub(r"^```(?:json)?\s*|\s*```$", "", txt.strip())
    s, e = txt.find("["), txt.rfind("]")
    return json.loads(txt[s:e + 1]) if s >= 0 else []


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", required=True); ap.add_argument("--out", required=True)
    ap.add_argument("--role", required=True); ap.add_argument("--batch", type=int, default=13); ap.add_argument("--only")
    a = ap.parse_args()
    model = yaml.safe_load(open(ROOT / "config" / "models.yaml"))["roles"][a.role]["model"]
    items = json.load(open(a.inp))
    if a.only:
        keep = {x.strip().upper() for x in a.only.split(",")}
        items = [i for i in items if i["focal"] in keep]
    out, calls = [], []
    for k in range(0, len(items), a.batch):
        chunk = items[k:k + a.batch]
        body = "\n\n".join(f'id: {i["id"]}\nfocal company: {i["focal"]}\nclaim: source "{i["source"]}" --{i["type"]}--> target "{i["target"]}"\nsentence: "{i["quote"]}"' for i in chunk)
        res, info = call(model, f"{RULES}\n\n{body}", SYSTEM)
        info["batch"] = k // a.batch + 1
        try:
            got = {r["id"]: r for r in parse(res)}
        except Exception as ex:
            got, info["parse_error"] = {}, str(ex)[:200]
        calls.append(info)
        for i in chunk:
            r = got.get(i["id"], {"verdict": "uncertain", "reason": "verifier returned no answer for this item"})
            out.append({"id": i["id"], "checks": {"quote_present": bool(i.get("quote_found")), "supports_claim": r.get("supports_claim"),
                                                  "direction": r.get("direction"), "type": r.get("type")},
                        "verdict": r.get("verdict") if r.get("verdict") in ("pass", "fail", "uncertain") else "uncertain",
                        "reason": r.get("reason", ""), "verifier_model": model})
        print(f"batch {info['batch']}: {len(chunk)} items, ${info['cost_usd']:.4f}, {info['seconds']}s", flush=True)
    d = pathlib.Path(a.out); d.mkdir(parents=True, exist_ok=True)
    json.dump(out, open(d / "verification_results.json", "w"), indent=1)
    tot = {k: sum(c[k] for c in calls) for k in ("input_tokens", "cache_creation_tokens", "cache_read_tokens", "output_tokens", "cost_usd", "seconds")}
    json.dump({"role": a.role, "model": model, "items": len(out), "calls": calls, "totals": tot}, open(d / "verification_run.json", "w"), indent=1)
    print(f"{len(out)} edges verified by {model}: in={tot['input_tokens']+tot['cache_creation_tokens']+tot['cache_read_tokens']} out={tot['output_tokens']} cost=${tot['cost_usd']:.4f}")


if __name__ == "__main__":
    main()
