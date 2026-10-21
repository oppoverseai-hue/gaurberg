"""M3 hero set: CRWV extraction output, written by the extractor role (Claude Code session, Sonnet 5.5)
from the FY2025 10-K (filed 2026-03-02): Items 1, 1A, 7 and the financial-statement notes (Item 8).
Every edge carries the exact sentence it came from. Quotes are checked by verify_quotes.py.
exposure_pct is set only where the filing states a figure."""
import json

URL = "https://www.sec.gov/Archives/edgar/data/1769628/000176962826000104/crwv-20251231.htm"
Q_MSFT = "We recognized an aggregate of approximately 67% of our revenue from our top customer, Microsoft, for the year ended December 31, 2025."
Q_MSFT2 = "Other significant customers include Microsoft and Meta."
Q_OAI1 = "In May 2025, we entered into a master services agreement with OpenAI OpCo, LLC (\"OpenAI\") and in September 2025, we entered into an order form under this master services agreement pursuant to which OpenAI has committed to pay us up to approximately $6.5 billion through May 31, 2031 and, as a result, we expect OpenAI to be a significant customer in future periods."
Q_OAI2 = "For example, in March 2025, we entered into a master services agreement with OpenAI, a private company, pursuant to which OpenAI has committed to pay us up to approximately $11.9 billion through October 2030."
Q_META = "Similarly, in September 2025, we entered into an order form under an existing master services agreement pursuant to which Meta Platforms, Inc. (\"Meta\") initially committed to pay us up to approximately $14.2 billion through December 2031 and, as a result, we also expect Meta to be a significant customer in future periods."
Q_GPU = "For example, as a result of our obligations in our current customer contracts, all of the GPUs used in our infrastructure today are NVIDIA GPUs."
Q_NVINV = "In January 2026, NVIDIA Corporation invested $ 2 billion in the Company's Class A common stock at a purchase price of $ 87.20 per share."
Q_NVCOL = "For example, in January 2026, we announced that we entered into a collaboration framework with NVIDIA Corporation to expand our long-standing complementary relationship to advance AI adoption at global scale."
Q_COMP = "Key competitors that offer general purpose cloud computing services as part of a broader, diversified product portfolio include Amazon (AWS), Google (Google Cloud Platform), Microsoft (Azure), and Oracle, a number of which are also our current customers."
Q_CPU = "CoreWeave clusters also use cutting edge CPUs, including AMD and Intel chips, to power compute-intensive projects and to help our customers get more out of GPU compute."
Q_MAG = "Magnetar was a related party of the Company through March 2025, as Magnetar-affiliated funds collectively held a significant equity interest in the Company and Magnetar had representation on the Company's Board."

def ev(section, quote): return {"section": section, "quote": quote}
E = []
def add(cp, et, t, src, tgt, evs, pct=None, qual=None):
    E.append((cp, et, t, src, tgt, evs, pct, qual))

add("Microsoft", "public_company", "sells_to", "CRWV", "Microsoft", [ev("risk_factors", Q_MSFT), ev("risk_factors", Q_MSFT2)], 67, "approximate")
add("OpenAI", "private_company", "sells_to", "CRWV", "OpenAI", [ev("risk_factors", Q_OAI1), ev("risk_factors", Q_OAI2)])
add("Meta", "public_company", "sells_to", "CRWV", "Meta", [ev("risk_factors", Q_META), ev("risk_factors", Q_MSFT2)])
add("NVIDIA", "public_company", "supplies", "NVIDIA", "CRWV", [ev("risk_factors", Q_GPU)])
add("NVIDIA", "public_company", "invests", "NVIDIA", "CRWV", [ev("notes", Q_NVINV)])
add("NVIDIA", "public_company", "partners", "CRWV", "NVIDIA", [ev("risk_factors", Q_NVCOL)])
for n, et in [("Amazon", "public_company"), ("Alphabet", "public_company"), ("Microsoft", "public_company"), ("Oracle", "public_company")]:
    add(n, et, "competes", "CRWV", n, [ev("risk_factors", Q_COMP)])
add("AMD", "public_company", "supplies", "AMD", "CRWV", [ev("business", Q_CPU)])
add("Intel", "public_company", "supplies", "Intel", "CRWV", [ev("business", Q_CPU)])
add("Magnetar", "private_company", "invests", "Magnetar", "CRWV", [ev("notes", Q_MAG)])

out = [{"counterparty": c, "entity_type": et, "type": t, "source": s, "target": tg, "evidence": evs,
        "document_url": URL, "as_of": "2025-12-31", "exposure_pct": p, "exposure_qualifier": q} for c, et, t, s, tg, evs, p, q in E]
json.dump(out, open("crwv_extraction.json", "w"), ensure_ascii=False, indent=1)
print(len(out), "edges,", sum(len(e["evidence"]) for e in out), "evidence rows")
