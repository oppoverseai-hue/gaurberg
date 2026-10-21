"""Score the verification agent: VER-1 to VER-4 (Eval Spec thresholds).

Usage: python3 -I evals/harness/score_verification.py DIR [--set evals/seeded_errors/seeded_set.json] [--only CRWV] [--out file.json]
  VER-1 seeded-error catch rate = planted-error items the verifier flagged (fail or uncertain) / planted-error items   (>= 90%)
  VER-2 false-flag rate         = correct items the verifier marked fail / correct items                              (<= 15%)
  VER-3 verifier independence   = verifier model vendor differs from the extractor's, read from config/models.yaml    (always)
  VER-4 cost per verified edge  = model cost of the run / edges verified                                              (logged)
Also reported: strict catch rate (fail only), uncertain share of correct items, and the catch rate by error kind."""
import argparse, json, pathlib, yaml
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parents[2]
VENDOR = {"claude": "anthropic", "gemini": "google", "gpt": "openai", "deepseek": "deepseek"}


def vendor(mid):
    return VENDOR.get(mid.split("-")[0].lower(), mid.split("-")[0].lower()) if mid and mid != "TBD" else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("dir"); ap.add_argument("--set", default=str(ROOT / "evals" / "seeded_errors" / "seeded_set.json"))
    ap.add_argument("--only"); ap.add_argument("--out")
    a = ap.parse_args()
    items = {i["id"]: i for i in json.load(open(a.set))}
    res = {r["id"]: r for r in json.load(open(pathlib.Path(a.dir) / "verification_results.json"))}
    run = json.load(open(pathlib.Path(a.dir) / "verification_run.json"))
    cfg = yaml.safe_load(open(ROOT / "config" / "models.yaml"))["roles"]
    ids = [i for i in res if i in items and (not a.only or items[i]["focal"] in {x.upper() for x in a.only.split(",")})]
    bad = [i for i in ids if items[i]["planted"] != "none"]
    ok = [i for i in ids if items[i]["planted"] == "none"]
    flagged = sum(res[i]["verdict"] != "pass" for i in bad)
    strict = sum(res[i]["verdict"] == "fail" for i in bad)
    wrong = sum(res[i]["verdict"] == "fail" for i in ok)
    unsure = sum(res[i]["verdict"] == "uncertain" for i in ok)
    kinds = defaultdict(lambda: [0, 0])
    for i in bad:
        kinds[items[i]["planted"]][1] += 1
        kinds[items[i]["planted"]][0] += res[i]["verdict"] != "pass"
    ext_v, ver_v = vendor(cfg["extractor"]["model"]), vendor(run["model"])
    scored_ids = set(ids)
    cost = sum(c["cost_usd"] for c in run["calls"]) * (len(ids) / max(1, run["items"]))
    r = {"VER-1": flagged / len(bad), "VER-2": wrong / len(ok), "VER-3": bool(ext_v and ver_v and ext_v != ver_v),
         "VER-4": cost / len(ids), "detail": {"planted": len(bad), "correct": len(ok), "flagged": flagged, "strict_fail": strict,
                                              "correct_marked_fail": wrong, "correct_marked_uncertain": unsure,
                                              "catch_by_kind": {k: f"{v[0]}/{v[1]}" for k, v in kinds.items()},
                                              "verifier_model": run["model"], "verifier_vendor": ver_v, "extractor_vendor": ext_v}}
    print(f"VER-1 catch rate {r['VER-1']:.1%}  ({'pass' if r['VER-1'] >= 0.90 else 'fail'}, bar 90%)  strict {strict}/{len(bad)}  by kind {r['detail']['catch_by_kind']}")
    print(f"VER-2 false-flag {r['VER-2']:.1%}  ({'pass' if r['VER-2'] <= 0.15 else 'fail'}, bar 15%)  uncertain on correct: {unsure}/{len(ok)}")
    print(f"VER-3 independence {'pass' if r['VER-3'] else 'FAIL'}: verifier {run['model']} ({ver_v}) vs extractor {cfg['extractor']['model']} ({ext_v})")
    print(f"VER-4 cost per verified edge ${r['VER-4']:.5f}  (logged)")
    for i in bad:
        if res[i]["verdict"] == "pass":
            it = items[i]; print("  MISSED", it["planted"], it["focal"], it["source"], it["type"], it["target"], "|", res[i]["reason"][:80])
    for i in ok:
        if res[i]["verdict"] == "fail":
            it = items[i]; print("  FALSE FLAG", it["focal"], it["source"], it["type"], it["target"], "|", res[i]["reason"][:80])
    if a.out:
        json.dump(r, open(a.out, "w"), indent=1)


if __name__ == "__main__":
    main()
