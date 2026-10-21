"""M2 spike: UBER extraction output, written by the extractor role (Claude Code session, Sonnet 5.5)
from the FY2025 10-K sections. Every edge carries the exact sentence it came from.
Writes uber_extraction.json. Quotes are checked against the filing text by verify_quotes.py."""
import json

URL = "https://www.sec.gov/Archives/edgar/data/1543151/000154315126000015/uber-20251231.htm"
Q_RIDE = "We also compete with other ridesharing companies for Drivers and Riders, including Bolt, Didi, Lyft, and Ola."
Q_AV = "There are also a number of companies developing and introducing autonomous vehicles and technologies that either are competing with us or may compete with us in the future, including Alphabet (Waymo), Amazon (Zoox), and Tesla."
Q_DEL = "Our Delivery offering competes with numerous companies in the meal, grocery and other delivery space in various regions for Drivers, consumers, and merchants, including DoorDash, Instacart, Gopuff, Rappi, Delivery Hero, Just Eat Takeaway, and Amazon."
Q_FRT = "Our Freight offering competes with global and North American freight brokers and managed transportation providers such as C.H. Robinson, Total Quality Logistics, RXO, XPO, Echo Global Logistics, and DHL."
Q_MIN = "a significant portion of our assets includes minority ownership positions, including in Didi, Grab, and Aurora."
Q_LUCID = "we agreed to purchase, or have our designated fleet operators purchase, a minimum of 20,000 Lucid vehicles equipped with Nuro’s Level 4 autonomous driving systems over a six-year period"
Q_WAYMO = "Waymo has introduced a commercialized ridehailing fleet of autonomous vehicles on its own platform in addition to a fleet of autonomous vehicles that it makes available through our platform"
Q_MOOVE = "we entered into and completed a series of agreements with Moove, including (i) an equity investment, through preferred shares, (ii) a term loan to Moove, and (iii) a commercial partnership agreement"
Q_CONNECT = "We connect consumers (“Rider(s)”) with independent providers of ride services (“Mobility Driver(s)”) for ridesharing services"
Q_COURIER = "with delivery service providers (“Couriers”) for meal preparation, grocery and other delivery services"

def ev(section, quote): return {"section": section, "quote": quote}

# (counterparty, entity_type, type, source, target, evidence list)
E = []
def comp(name, et, *evs): E.append((name, et, "competes", "UBER", name, list(evs)))
comp("Bolt", "private_company", ev("business", Q_RIDE))
comp("Didi", "private_company", ev("business", Q_RIDE))
comp("Lyft", "public_company", ev("business", Q_RIDE))
comp("Ola", "private_company", ev("business", Q_RIDE))
comp("Alphabet", "public_company", ev("business", Q_AV))
comp("Amazon", "public_company", ev("business", Q_AV), ev("business", Q_DEL))
comp("Tesla", "public_company", ev("business", Q_AV))
comp("DoorDash", "public_company", ev("business", Q_DEL))
comp("Instacart", "public_company", ev("business", Q_DEL))
comp("Gopuff", "private_company", ev("business", Q_DEL))
comp("Rappi", "private_company", ev("business", Q_DEL))
comp("Delivery Hero", "public_company", ev("business", Q_DEL))
comp("Just Eat Takeaway", "public_company", ev("business", Q_DEL))
for n in ["C.H. Robinson", "Total Quality Logistics", "RXO", "XPO", "Echo Global Logistics", "DHL"]:
    comp(n, "public_company" if n in ("C.H. Robinson", "RXO", "XPO") else "private_company", ev("business", Q_FRT))

def inv(name, et, *evs): E.append((name, et, "invests", "UBER", name, list(evs)))
inv("Aurora", "public_company", ev("mdna", "a $802 million net unrealized loss on our Aurora investment"), ev("risk_factors", Q_MIN))
inv("Didi", "private_company", ev("mdna", "a $409 million net unrealized gain on our Didi investment"), ev("risk_factors", Q_MIN))
inv("Grab", "public_company", ev("mdna", "a $145 million net unrealized gain on our Grab investment"), ev("risk_factors", Q_MIN))
inv("Lucid", "public_company", ev("mdna", "a $155 million net unrealized loss on our Lucid investment"))
inv("Waabi", "private_company", ev("mdna", "a $179 million net unrealized gain on our Waabi investment"))
inv("Lime", "private_company", ev("notes", "is considered a related party as a result of our investment in Lime Common Stock"))
inv("Moove", "private_company", ev("notes", Q_MOOVE))

E.append(("Moove", "private_company", "partners", "UBER", "Moove", [ev("notes", Q_MOOVE)]))
E.append(("Arizona State University", "organization", "partners", "UBER", "Arizona State University",
          [ev("business", "our partnership with Arizona State University")]))
E.append(("ITF", "organization", "partners", "UBER", "ITF",
          [ev("business", "We renewed our agreement with the ITF (International Transport Workers’ Federation)")]))
E.append(("UGT", "organization", "partners", "UBER", "UGT",
          [ev("business", "Uber Eats and the UGT (Unión General de Trabajadores) signed a memorandum of understanding")]))

E.append(("Waymo", "private_company", "supplies", "Waymo", "UBER", [ev("risk_factors", Q_WAYMO)]))
E.append(("Lucid", "public_company", "supplies", "Lucid", "UBER", [ev("mdna", Q_LUCID)]))
E.append(("Nuro", "private_company", "supplies", "Nuro", "UBER", [ev("mdna", Q_LUCID)]))
E.append(("Mobility Drivers", "segment_group", "supplies", "Mobility Drivers", "UBER", [ev("business", Q_CONNECT)]))
E.append(("Couriers", "segment_group", "supplies", "Couriers", "UBER", [ev("business", Q_COURIER)]))
E.append(("Riders", "segment_group", "sells_to", "UBER", "Riders", [ev("business", Q_CONNECT)]))

out = [{"counterparty": c, "entity_type": et, "type": t, "source": s, "target": tg, "evidence": evs,
        "document_url": URL, "as_of": "2025-12-31", "exposure_pct": None} for c, et, t, s, tg, evs in E]
json.dump(out, open("uber_extraction.json", "w"), ensure_ascii=False, indent=1)
print(len(out), "edges,", sum(len(e["evidence"]) for e in out), "evidence rows")
