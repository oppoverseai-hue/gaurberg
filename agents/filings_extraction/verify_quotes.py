"""Free check: is each quote found, word for word, in the filing text? Usage: verify_quotes.py <full.txt> <extraction.json>"""
import json, re, sys
norm = lambda s: re.sub(r"\s+", " ", s).strip()
full = norm(open(sys.argv[1], encoding="utf-8").read())
edges = json.load(open(sys.argv[2]))
bad, total = [], 0
for e in edges:
    for v in e["evidence"]:
        total += 1
        v["quote_found"] = norm(v["quote"]) in full
        if not v["quote_found"]:
            bad.append((e["counterparty"], e["type"], v["quote"][:90]))
json.dump(edges, open(sys.argv[2], "w"), ensure_ascii=False, indent=1)
print(f"{total - len(bad)}/{total} quotes found")
for b in bad: print("NOT FOUND:", b)
