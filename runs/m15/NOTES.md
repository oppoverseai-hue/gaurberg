# M15 Hong Kong: WeRide (WRD), Pony.ai (PONY), Baidu (BIDU), Lenovo (0992)

Agent runs 61-64, 141 links staged on Oct 23, 2026, reviewed by the admin the same day (recommendations accepted: Keep 112, Fix 18, Drop 11).
Result: 129 promoted as Curated (112 Keep, 17 Fix), 12 rejected (11 Drop plus link 591 merged into 599). Nothing is staged.
Extractor: run_report.py, role `extractor` (claude-sonnet-5-5). Cost: WRD $1.94, PONY $1.63, BIDU $2.10, Lenovo $1.13 (list price).
Sources: WRD, PONY and BIDU Form 20-F for 2025 (EDGAR); Lenovo 2025/26 Annual Report supplied as a file (no URL or publication date stored).
Tickers: WRD (Nasdaq; HKEX 0800), PONY (Nasdaq; HKEX 2026), BIDU (Nasdaq; HKEX 9888), 0992 (HKEX). Baidu (id 63) and Lenovo (id 374) were existing unmapped nodes and were reused.
Segment and size group set by the admin's request (judgement, not data): WRD business/small, PONY business/small, BIDU consumer/mid, Lenovo consumer/large; London: AML consumer/small, BYIT, CCC, SCT business/small.
Fixes applied: stakes set (Uber 5.6% in WRD, Toyota 9.8% and Cyantron 51% for Pony, Baidu about 7% in Trip.com); percentages removed where the quote did not state them (BlackRock and Handsome Reward in Baidu); iQIYI competitors re-pointed from Baidu to iQIYI; duplicate nodes merged for Yutong, Alliance Automotive R&D and Dubai RTA.
Also promoted: Softcat acquires General Datatech (564, pending deal, note kept).
Not done: offline snapshot refresh (admin downloads /api/snapshot), geographic revenue extraction for the four companies, gold set and scorer for Hong Kong.
Files: *_extraction.json (raw), resolved/ (after entity resolution), *_load.sql, review sheet m15_review_full.csv, REVIEW_RECOMMENDATIONS.md.
