"""M3 acquisitions pass (new link type 'acquires': source = acquirer, target = acquired company).
Written by the extractor role (Claude Code session, Sonnet 5.5) from the FY2025 10-Ks of UBER, CRWV and LYFT.
Writes uber_acq.json, crwv_acq.json, lyft_acq.json. Quotes are checked by verify_quotes.py.
exposure_pct (basis 'ownership') is set only where the filing states a share. Pending deals carry a note."""
import json

def ev(section, quote): return {"section": section, "quote": quote}
def edge(cp, et, t, src, tgt, evs, pct=None, qual=None, note=None):
    return {"counterparty": cp, "entity_type": et, "type": t, "source": src, "target": tgt, "evidence": evs,
            "as_of": "2025-12-31", "exposure_pct": pct, "exposure_qualifier": qual,
            "exposure_basis": "ownership" if pct is not None else None, "note": note}

UBER = "https://www.sec.gov/Archives/edgar/data/1543151/000154315126000015/uber-20251231.htm"
CRWV = "https://www.sec.gov/Archives/edgar/data/1769628/000176962826000104/crwv-20251231.htm"
LYFT = "https://www.sec.gov/Archives/edgar/data/1759509/000162828026006960/lyft-20251231.htm"

Q_NEW = "For example, through our acquisition of Cornershop, a provider of online grocery delivery in several countries including Mexico and Chile, we expanded our Delivery offering to grocery delivery."
Q_DRZ = "Additionally, in October 2021, we acquired The Drizly Group, Inc. in order to further expand our Delivery offering to alcohol."
Q_TRP = "In November 2021, our subsidiary Uber Freight acquired Transplace, expanding Uber Freight’s business through Transplace’s expertise in transportation management."
Q_BRAND = "some of our acquired and majority-owned companies, including Careem, Postmates and Cornershop, have or will continue to use their own brands"
Q_TGO = "On June 17, 2025, we closed the acquisition of an 85 % controlling stake in Trendyol GO."
Q_TGO2 = "As of December 31, 2025, our controlling stake in Trendyol GO was 86 %."
Q_GET = "we entered into an agreement with Mubadala Investment Company to acquire Getir Perakende Lojistik A.Ş.'s (“Getir”) delivery portfolio in Türkiye."
Q_GET2 = "the agreement to acquire 100 % of Getir’s food delivery business and a minority interest in its grocery delivery business at the outset, for $ 435 million in cash"
Q_CAR = "Upon closing of the transaction in December 2023, e& acquired a majority stake in Careem Technologies and we retained a minority ownership interest."
uber = [
 edge("Trendyol GO", "private_company", "acquires", "UBER", "Trendyol GO", [ev("notes", Q_TGO), ev("notes", Q_TGO2)], 86, "exact"),
 edge("Cornershop", "private_company", "acquires", "UBER", "Cornershop", [ev("risk_factors", Q_NEW), ev("risk_factors", Q_BRAND)]),
 edge("Drizly", "private_company", "acquires", "UBER", "Drizly", [ev("risk_factors", Q_DRZ)]),
 edge("Transplace", "private_company", "acquires", "UBER", "Transplace", [ev("risk_factors", Q_TRP)]),
 edge("Postmates", "private_company", "acquires", "UBER", "Postmates", [ev("risk_factors", Q_BRAND)]),
 edge("Getir", "private_company", "acquires", "UBER", "Getir", [ev("notes", Q_GET), ev("notes", Q_GET2)], note="Pending: food delivery business expected to close in the second half of 2026, subject to regulatory approval"),
 edge("Careem Technologies", "private_company", "invests", "UBER", "Careem Technologies", [ev("notes", Q_CAR)]),
 edge("e&", "public_company", "acquires", "e&", "Careem Technologies", [ev("notes", Q_CAR)], note="Majority stake; share not stated in the filing"),
]
crwv = [
 edge("Weights & Biases", "private_company", "acquires", "CRWV", "Weights & Biases", [ev("business", "With Weights & Biases (acquired by CoreWeave in 2025)")]),
 edge("OpenPipe", "private_company", "acquires", "CRWV", "OpenPipe", [ev("business", "in September 2025, we acquired OpenPipe, a leading platform for training AI agents with RL")]),
 edge("Marimo", "private_company", "acquires", "CRWV", "Marimo", [ev("business", "In October 2025, we also acquired Marimo, creator of the marimo notebook, an open-source, AI-native environment")]),
 edge("Monolith", "private_company", "acquires", "CRWV", "Monolith", [ev("business", "in November 2025 we acquired Monolith, which provides a full-stack platform for enterprises that want to accelerate industrial innovation in the physical world"), ev("risk_factors", "in November 2025, we acquired Monolith AI Limited, a pioneer in applying artificial intelligence and high performance computing to solve complex physics and engineering challenges")]),
]
lyft = [
 edge("Freenow", "private_company", "acquires", "LYFT", "Freenow", [ev("risk_factors", "In July 2025, we acquired Freenow, and in October 2025, we acquired TBR.")]),
 edge("TBR", "private_company", "acquires", "LYFT", "TBR", [ev("business", "In October 2025, we acquired TheBookingRoomGroup Limited (d/b/a TBR Global Chauffeuring, or “TBR”), a global luxury chauffeuring company that operates in thousands of cities worldwide.")]),
 edge("Flexdrive", "private_company", "acquires", "LYFT", "Flexdrive", [ev("risk_factors", "in connection with our acquisition of Flexdrive, which is an independently managed, wholly-owned subsidiary")], 100, "exact"),
]
for name, edges, url in [("uber_acq.json", uber, UBER), ("crwv_acq.json", crwv, CRWV), ("lyft_acq.json", lyft, LYFT)]:
    for e in edges: e["document_url"] = url
    json.dump(edges, open(name, "w"), ensure_ascii=False, indent=1)
    print(name, len(edges), "edges,", sum(len(e["evidence"]) for e in edges), "evidence rows")
