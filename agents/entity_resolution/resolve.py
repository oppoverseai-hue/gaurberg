"""Entity resolution agent (rules only, no model call). Agent 3 of 5: runs after extraction, before verification.

Usage: python3 -I agents/entity_resolution/resolve.py TICKER --in DIR --out DIR
  DIR/<ticker>_extraction.json (raw names)  ->  OUT/<ticker>_extraction.json (canonical names, merged edges)
                                                OUT/<ticker>_resolution_report.json
What it does, in order:
  1. exact match to a known node by name or ticker (known = seed list + every counterparty already in a staged extraction);
  2. alias table (aliases.csv): same_entity aliases are merged, subsidiary aliases are reported but not merged;
  3. normalized match: lowercase, no punctuation or parentheses, legal suffixes removed (Inc, LLC, Limited, Corporation...);
     a name that is the whole-token prefix of another name differing only by generic words (AI, Platforms, Technologies...) also matches;
  4. otherwise a new node, de-duplicated against the other new names in the run;
  5. edges with the same counterparty, type and direction are merged and their evidence is joined.
Opposite-direction edges to the same company are NOT merged: they are reported as direction_conflicts for verification and review.
Every non-exact match is listed in the report for the sampled admin review. Nothing is written to the database."""
import argparse, csv, json, pathlib, re

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
EXTR = ROOT / "agents" / "filings_extraction"
LEGAL = {"inc", "llc", "ltd", "limited", "corp", "corporation", "co", "company", "plc", "gmbh", "ag", "sa", "nv", "lp", "llp", "the", "incorporated"}
GENERIC = {"ai", "platforms", "technologies", "technology", "holdings", "group", "labs", "systems", "global", "international"}


def norm(name):
    s = re.sub(r"\([^)]*\)", " ", name.lower().replace("&", " and "))
    toks = [t for t in re.sub(r"[^a-z0-9 ]+", " ", s).split() if t not in LEGAL]
    return " ".join(toks)


def match_key(name):
    """Comparison key used by the scorer: normalized, with trailing generic words dropped (Meta Platforms -> meta)."""
    toks = norm(name).split()
    while len(toks) > 1 and toks[-1] in GENERIC:
        toks.pop()
    return " ".join(toks)


def near(a, b):
    """True when one normalized name is the token prefix of the other and the rest is generic words only."""
    ta, tb = a.split(), b.split()
    short, long_ = (ta, tb) if len(ta) <= len(tb) else (tb, ta)
    return bool(short) and long_[:len(short)] == short and all(t in GENERIC for t in long_[len(short):])


def known_nodes(skip_ticker):
    nodes = {}
    for r in csv.DictReader(open(ROOT / "db" / "seed" / "companies_seed.csv", encoding="utf-8")):
        nodes[r["name"]] = {"name": r["name"], "ticker": r["ticker"], "origin": "seed"}
    for p in sorted(EXTR.glob("*_*.json")):
        if p.name.split("_")[0].upper() == skip_ticker or not p.name.endswith(("_extraction.json", "_acq.json")):
            continue
        for e in json.load(open(p)):
            nodes.setdefault(e["counterparty"], {"name": e["counterparty"], "ticker": None, "origin": "staged:" + p.name})
    return nodes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ticker"); ap.add_argument("--in", dest="inp", required=True); ap.add_argument("--out", required=True)
    a = ap.parse_args()
    t = a.ticker.upper()
    edges = json.load(open(pathlib.Path(a.inp) / f"{t.lower()}_extraction.json"))
    aliases = {norm(r["alias"]): r for r in csv.DictReader(open(HERE / "aliases.csv", encoding="utf-8"))}
    nodes = known_nodes(t)
    by_norm = {norm(n["name"]): n for n in nodes.values()}
    by_ticker = {n["ticker"].lower(): n for n in nodes.values() if n["ticker"]}
    new, mapping, review = {}, {}, []

    def resolve(raw):
        if raw in mapping:
            return mapping[raw]
        n = norm(raw)
        paren = [norm(x) for x in re.findall(r"\(([^)]*)\)", raw.replace("d/b/a", ""))]
        if raw in nodes:
            res = (raw, "exact")
        elif raw.lower() in by_ticker:
            res = (by_ticker[raw.lower()]["name"], "ticker")
        elif n in aliases:
            al = aliases[n]
            res = (al["canonical"], "alias") if al["kind"] == "same_entity" else (nodes.get(raw, {"name": raw})["name"], "subsidiary_not_merged:" + al["canonical"])
        elif n in by_norm:
            res = (by_norm[n]["name"], "normalized")
        elif any(x in by_norm for x in paren):
            res = (by_norm[next(x for x in paren if x in by_norm)]["name"], "parenthetical")
        else:
            cands = sorted({v["name"] for k, v in by_norm.items() if near(n, k)})
            if len(cands) == 1:
                res = (cands[0], "normalized_near")
            elif len(cands) > 1:
                res = (raw, "ambiguous:" + "|".join(cands))
            else:
                hit = next((nm for k, nm in new.items() if k == n or near(n, k)), None)
                if hit:
                    res = (hit, "merged_new")
                else:
                    new[n] = raw; res = (raw, "new")
        mapping[raw] = res
        if res[1] not in ("exact", "new"):
            review.append({"raw": raw, "resolved": res[0], "how": res[1]})
        return res

    out, merged, dropped = {}, 0, []
    focal = by_ticker.get(t.lower(), {}).get("name")
    for e in edges:
        canon, how = resolve(e["counterparty"])
        e = dict(e, counterparty=canon)
        # An end counts as the focal company when it is the ticker or resolves to the focal company's name (for example a unit under the parent rule).
        is_focal = {k: e[k] == t or (focal is not None and resolve(e[k])[0] == focal) for k in ("source", "target")}
        if not any(is_focal.values()):
            # A deal between two other companies (for example a buyer and a unit the focal company sold) is not a link of the focal company
            # and would become a self-link. It is dropped and listed in the report for the admin.
            dropped.append({"source": e["source"], "type": e["type"], "target": e["target"], "quote": (e["evidence"] or [{}])[0].get("quote", "")})
            continue
        for k in ("source", "target"):
            e[k] = t if is_focal[k] else canon
        key = (canon.lower(), e["type"], e["source"].lower(), e["target"].lower())
        if key in out:
            merged += 1
            seen = {v["quote"] for v in out[key]["evidence"]}
            out[key]["evidence"] += [v for v in e["evidence"] if v["quote"] not in seen]
            if out[key].get("exposure_pct") is None:
                out[key]["exposure_pct"], out[key]["exposure_qualifier"] = e.get("exposure_pct"), e.get("exposure_qualifier")
        else:
            out[key] = e
    res_edges = list(out.values())
    conflicts = []
    seen_dir = {}
    for e in res_edges:
        if e["type"] in ("supplies", "sells_to", "invests", "acquires"):
            seen_dir.setdefault((e["counterparty"].lower(), e["type"]), set()).add((e["source"], e["target"]))
    for (cp, typ), dirs in seen_dir.items():
        if len(dirs) > 1:
            conflicts.append({"counterparty": cp, "type": typ, "directions": sorted(f"{s}>{g}" for s, g in dirs)})
    outd = pathlib.Path(a.out); outd.mkdir(parents=True, exist_ok=True)
    json.dump(res_edges, open(outd / f"{t.lower()}_extraction.json", "w"), ensure_ascii=False, indent=1)
    rep = {"ticker": t, "edges_in": len(edges), "edges_out": len(res_edges), "edges_merged": merged,
           "new_nodes": sorted(new.values()), "needs_review": review, "direction_conflicts": conflicts, "dropped_not_focal": dropped}
    json.dump(rep, open(outd / f"{t.lower()}_resolution_report.json", "w"), indent=1)
    print(f"{t}: {len(edges)} edges in, {len(res_edges)} out, {merged} merged, {len(new)} new nodes, {len(review)} non-exact matches, {len(conflicts)} direction conflicts")
    for d in dropped: print("  dropped (not the focal company):", d["source"], d["type"], d["target"])
    for r in review: print("  review:", r)
    for c in conflicts: print("  conflict:", c)


if __name__ == "__main__":
    main()
