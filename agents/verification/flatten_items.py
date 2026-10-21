"""Flatten resolved extraction files into verifier items (one per edge, first quote that was found word for word, EXT-6).
Usage: flatten_items.py OUT.json runs/m6_resolved/nvda_extraction.json ..."""
import json, sys
items, n = [], 0
for p in sys.argv[2:]:
    for e in json.load(open(p)):
        ev = [v for v in e["evidence"] if v.get("quote_found")]
        if not ev or e["source"] == e["target"]: continue
        n += 1
        items.append({"id": n, "focal": p.split("/")[-1].split("_")[0].upper(), "counterparty": e["counterparty"], "type": e["type"],
                      "source": e["source"], "target": e["target"], "quote": ev[0]["quote"], "quote_found": True, "edge_key": f'{e["source"]}|{e["type"]}|{e["target"]}'})
json.dump(items, open(sys.argv[1], "w"), indent=1)
print(len(items), "items")
