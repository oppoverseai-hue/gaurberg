"""M3 hero set: LYFT extraction output, written by the extractor role (Claude Code session, Sonnet 5.5)
from the FY2025 10-K (filed 2026-02-11): Items 1, 1A, 7 and the notes. Every edge carries the exact sentence.
Quotes are checked by verify_quotes.py. exposure_pct is set only where the filing states a figure (none here)."""
import json

URL = "https://www.sec.gov/Archives/edgar/data/1759509/000162828026006960/lyft-20251231.htm"
Q_MAIN = "Our main ridesharing competitor is Uber and our main competitors for app-based intermediation services for taxi and private hire vehicles are Uber and Bolt, though we also compete with other TNCs, taxi cab and livery companies as well as traditional automotive manufacturers and technology companies."
Q_MAIN_RF = "Our main ridesharing competitor in the U.S. and Canada is Uber, and in Europe, our main competitors for app-based intermediation services for taxi and private hire vehicles are Uber and Bolt, though we also compete with other TNCs and taxicab and livery companies, as well as traditional automotive manufacturers and technology companies."
Q_BIKE = "Our main competitors in the bike and scooter sharing market include Lime, Bird, Fifteen, nextbike and Dott."
Q_BIKE_RF = "Our main competitors in bike and scooter sharing include Lime, Bird, Fifteen, nextbike and Dott."
Q_AV = "There are also a number of companies developing and introducing AV technology and TaaS offerings that either are competing with us or may compete with us in the future, including Alphabet (Waymo), Amazon (Zoox), Baidu, Bolt, and Tesla as well as many other technology companies and automobile manufacturers and suppliers."
Q_AWS = "We have a commercial agreement with Amazon Web Services (“AWS”) for cloud services to help deliver and host our platform."
Q_AWS2 = "On December 30, 2025, we entered into an addendum to our commercial agreement with AWS, pursuant to which we committed to spend an aggregate of at least $562.5 million between January 2026 and December 2030 on AWS services, with a minimum amount of $100 million in each of the five years."
Q_SAFE = "Additionally, if a rider or driver needs emergency assistance at any point, Lyft offers tools to help beyond 911 in-app integration with partners like ADT and RapidSOS."

def ev(section, quote): return {"section": section, "quote": quote}
E = []
def add(cp, et, t, src, tgt, evs): E.append((cp, et, t, src, tgt, evs))

add("Uber", "public_company", "competes", "LYFT", "Uber", [ev("business", Q_MAIN), ev("risk_factors", Q_MAIN_RF)])
add("Bolt", "private_company", "competes", "LYFT", "Bolt", [ev("business", Q_MAIN), ev("risk_factors", Q_MAIN_RF), ev("business", Q_AV)])
for n in ["Lime", "Bird", "Fifteen", "nextbike", "Dott"]:
    add(n, "private_company", "competes", "LYFT", n, [ev("business", Q_BIKE), ev("risk_factors", Q_BIKE_RF)])
add("Alphabet", "public_company", "competes", "LYFT", "Alphabet", [ev("business", Q_AV)])
add("Amazon", "public_company", "competes", "LYFT", "Amazon", [ev("business", Q_AV)])
add("Baidu", "public_company", "competes", "LYFT", "Baidu", [ev("business", Q_AV)])
add("Tesla", "public_company", "competes", "LYFT", "Tesla", [ev("business", Q_AV)])
add("Amazon", "public_company", "supplies", "Amazon", "LYFT", [ev("business", Q_AWS), ev("risk_factors", Q_AWS2)])
add("ADT", "public_company", "partners", "LYFT", "ADT", [ev("business", Q_SAFE)])
add("RapidSOS", "private_company", "partners", "LYFT", "RapidSOS", [ev("business", Q_SAFE)])

out = [{"counterparty": c, "entity_type": et, "type": t, "source": s, "target": tg, "evidence": evs,
        "document_url": URL, "as_of": "2025-12-31", "exposure_pct": None, "exposure_qualifier": None} for c, et, t, s, tg, evs in E]
json.dump(out, open("lyft_extraction.json", "w"), ensure_ascii=False, indent=1)
print(len(out), "edges,", sum(len(e["evidence"]) for e in out), "evidence rows")
