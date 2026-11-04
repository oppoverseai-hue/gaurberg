-- DAT-8 part 1: approved rows that are verified. Written Nov 4, 2026 from the admin's decisions on PR #81.
-- The admin runs this in the Supabase SQL editor. It writes promoted tables (companies, relationships).
-- Every update is guarded so it changes nothing if the row already differs from what was reviewed.
-- Held back (see decisions_2026-11-04.md):
--   X2, X4-X67 (codes still to be checked on each exchange's site), X23, X42, X57, N7,
--   the rejection of link 462 (D13), and C1-C3 (kept as groups).
begin;

-- T1-T80: US listings, from SEC company_tickers_exchange.json (Nov 4, 2026).
update companies set ticker = 'RXO', cik = '0001929561', markets = array['US'], exchange = 'NYSE' where id = 28 and ticker is null; -- T1 RXO
update companies set ticker = 'CHRW', cik = '0001043277', markets = array['US'], exchange = 'Nasdaq' where id = 29 and ticker is null; -- T2 C.H. Robinson
update companies set ticker = 'XPO', cik = '0001166003', markets = array['US'], exchange = 'NYSE' where id = 55 and ticker is null; -- T3 XPO
update companies set ticker = 'ADT', cik = '0001703056', markets = array['US'], exchange = 'NYSE' where id = 66 and ticker is null; -- T4 ADT
update companies set ticker = 'TM', cik = '0001094517', markets = array['US'], exchange = 'NYSE' where id = 88 and ticker is null; -- T5 Toyota
update companies set ticker = 'PCAR', cik = '0000075362', markets = array['US'], exchange = 'Nasdaq' where id = 93 and ticker is null; -- T6 PACCAR
update companies set ticker = 'R', cik = '0000085961', markets = array['US'], exchange = 'NYSE' where id = 95 and ticker is null; -- T7 Ryder Systems
update companies set ticker = 'MBLY', cik = '0001910139', markets = array['US'], exchange = 'Nasdaq' where id = 105 and ticker is null; -- T8 Mobileye
update companies set ticker = 'RIVN', cik = '0001874178', markets = array['US'], exchange = 'Nasdaq' where id = 116 and ticker is null; -- T9 Rivian
update companies set ticker = 'QCOM', cik = '0000804328', markets = array['US'], exchange = 'Nasdaq' where id = 123 and ticker is null; -- T10 Qualcomm
update companies set ticker = 'AVGO', cik = '0001730168', markets = array['US'], exchange = 'Nasdaq' where id = 124 and ticker is null; -- T11 Broadcom
update companies set ticker = 'HPE', cik = '0001645590', markets = array['US'], exchange = 'NYSE' where id = 125 and ticker is null; -- T12 Hewlett Packard Enterprise
update companies set ticker = 'MU', cik = '0000723125', markets = array['US'], exchange = 'Nasdaq' where id = 126 and ticker is null; -- T13 Micron
update companies set ticker = 'MRVL', cik = '0001835632', markets = array['US'], exchange = 'Nasdaq' where id = 127 and ticker is null; -- T14 Marvell
update companies set ticker = 'AMBA', cik = '0001280263', markets = array['US'], exchange = 'Nasdaq' where id = 129 and ticker is null; -- T15 Ambarella
update companies set ticker = 'SKHY', cik = '0002120882', markets = array['US'], exchange = 'Nasdaq' where id = 130 and ticker is null; -- T16 SK Hynix
update companies set ticker = 'LITE', cik = '0001633978', markets = array['US'], exchange = 'Nasdaq' where id = 131 and ticker is null; -- T17 Lumentum
update companies set ticker = 'FN', cik = '0001408710', markets = array['US'], exchange = 'NYSE' where id = 134 and ticker is null; -- T18 Fabrinet
update companies set ticker = 'ASX', cik = '0001122411', markets = array['US'], exchange = 'NYSE' where id = 141 and ticker is null; -- T19 ASE
update companies set ticker = 'IBM', cik = '0000051143', markets = array['US'], exchange = 'NYSE' where id = 148 and ticker is null; -- T20 IBM
update companies set ticker = 'GSK', cik = '0001131399', markets = array['US'], exchange = 'NYSE' where id = 149 and ticker is null; -- T21 GSK
update companies set ticker = 'PYPL', cik = '0001633917', markets = array['US'], exchange = 'Nasdaq' where id = 155 and ticker is null; -- T22 PayPal
update companies set ticker = 'LSCC', cik = '0000855658', markets = array['US'], exchange = 'Nasdaq' where id = 164 and ticker is null; -- T23 Lattice Semiconductor
update companies set ticker = 'NXPI', cik = '0001413447', markets = array['US'], exchange = 'Nasdaq' where id = 167 and ticker is null; -- T24 NXP Semiconductors
update companies set ticker = 'UMC', cik = '0001033767', markets = array['US'], exchange = 'NYSE' where id = 168 and ticker is null; -- T25 UMC
update companies set ticker = 'ADI', cik = '0000006281', markets = array['US'], exchange = 'Nasdaq' where id = 170 and ticker is null; -- T26 Analog Devices
update companies set ticker = 'SONY', cik = '0000313838', markets = array['US'], exchange = 'NYSE' where id = 176 and ticker is null; -- T27 Sony
update companies set ticker = 'TXN', cik = '0000097476', markets = array['US'], exchange = 'Nasdaq' where id = 177 and ticker is null; -- T28 Texas Instruments
update companies set ticker = 'GFS', cik = '0001709048', markets = array['US'], exchange = 'Nasdaq' where id = 178 and ticker is null; -- T29 GLOBALFOUNDRIES
update companies set ticker = 'ASML', cik = '0000937966', markets = array['US'], exchange = 'Nasdaq' where id = 184 and ticker is null; -- T30 ASML
update companies set ticker = 'PHG', cik = '0000313216', markets = array['US'], exchange = 'NYSE' where id = 187 and ticker is null; -- T31 Philips
update companies set ticker = 'ADBE', cik = '0000796343', markets = array['US'], exchange = 'Nasdaq' where id = 193 and ticker is null; -- T32 Adobe
update companies set ticker = 'WDAY', cik = '0001327811', markets = array['US'], exchange = 'Nasdaq' where id = 197 and ticker is null; -- T33 Workday
update companies set ticker = 'CSCO', cik = '0000858877', markets = array['US'], exchange = 'Nasdaq' where id = 199 and ticker is null; -- T34 Cisco
update companies set ticker = 'SAP', cik = '0001000184', markets = array['US'], exchange = 'NYSE' where id = 201 and ticker is null; -- T35 SAP
update companies set ticker = 'MARA', cik = '0001507605', markets = array['US'], exchange = 'Nasdaq' where id = 205 and ticker is null; -- T36 MARA Holdings
update companies set ticker = 'CHRN', cik = '0001549084', markets = array['US'], exchange = 'Nasdaq' where id = 206 and ticker is null; -- T37 ChronoScale
update companies set ticker = 'HUT', cik = '0001964789', markets = array['US'], exchange = 'Nasdaq' where id = 208 and ticker is null; -- T38 Hut 8
update companies set ticker = 'CAT', cik = '0000018230', markets = array['US'], exchange = 'NYSE' where id = 209 and ticker is null; -- T39 Caterpillar
update companies set ticker = 'IREN', cik = '0001878848', markets = array['US'], exchange = 'Nasdaq' where id = 210 and ticker is null; -- T40 IREN
update companies set ticker = 'KEEL', cik = '0001812477', markets = array['US'], exchange = 'Nasdaq' where id = 211 and ticker is null; -- T41 Keel Infrastructure
update companies set ticker = 'CORZ', cik = '0001839341', markets = array['US'], exchange = 'Nasdaq' where id = 212 and ticker is null; -- T42 Core Scientific
update companies set ticker = 'FRMI', cik = '0002071778', markets = array['US'], exchange = 'Nasdaq' where id = 213 and ticker is null; -- T43 Fermi
update companies set ticker = 'CLSK', cik = '0000827876', markets = array['US'], exchange = 'Nasdaq' where id = 214 and ticker is null; -- T44 CleanSpark
update companies set ticker = 'BTDR', cik = '0001899123', markets = array['US'], exchange = 'Nasdaq' where id = 216 and ticker is null; -- T45 Bitdeer Technologies Group
update companies set ticker = 'BW', cik = '0001630805', markets = array['US'], exchange = 'NYSE' where id = 218 and ticker is null; -- T46 Babcock & Wilcox Enterprises
update companies set ticker = 'GLXY', cik = '0001859392', markets = array['US'], exchange = 'Nasdaq' where id = 219 and ticker is null; -- T47 Galaxy Digital
update companies set ticker = 'WULF', cik = '0001083301', markets = array['US'], exchange = 'Nasdaq' where id = 220 and ticker is null; -- T48 TeraWulf
update companies set ticker = 'HIVE', cik = '0001720424', markets = array['US'], exchange = 'Nasdaq' where id = 221 and ticker is null; -- T49 HIVE Digital Technologies
update companies set ticker = 'EQIX', cik = '0001101239', markets = array['US'], exchange = 'Nasdaq' where id = 223 and ticker is null; -- T50 Equinix
update companies set ticker = 'DLR', cik = '0001297996', markets = array['US'], exchange = 'NYSE' where id = 224 and ticker is null; -- T51 Digital Realty Trust
update companies set ticker = 'RIOT', cik = '0001167419', markets = array['US'], exchange = 'Nasdaq' where id = 225 and ticker is null; -- T52 Riot Platforms
update companies set ticker = 'CIFR', cik = '0001819989', markets = array['US'], exchange = 'Nasdaq' where id = 226 and ticker is null; -- T53 Cipher Digital
update companies set ticker = 'V', cik = '0001403161', markets = array['US'], exchange = 'NYSE' where id = 237 and ticker is null; -- T54 Visa
update companies set ticker = 'MUFG', cik = '0000067088', markets = array['US'], exchange = 'NYSE' where id = 249 and ticker is null; -- T55 MUFG
update companies set ticker = 'MA', cik = '0001141391', markets = array['US'], exchange = 'NYSE' where id = 254 and ticker is null; -- T56 Mastercard
update companies set ticker = 'MS', cik = '0000895421', markets = array['US'], exchange = 'NYSE' where id = 297 and ticker is null; -- T57 Morgan Stanley
update companies set ticker = 'WFC', cik = '0000072971', markets = array['US'], exchange = 'NYSE' where id = 298 and ticker is null; -- T58 Wells Fargo & Company
update companies set ticker = 'BAC', cik = '0000070858', markets = array['US'], exchange = 'NYSE' where id = 299 and ticker is null; -- T59 Bank of America Corporation
update companies set ticker = 'AMP', cik = '0000820027', markets = array['US'], exchange = 'NYSE' where id = 300 and ticker is null; -- T60 Ameriprise Financial Inc.
update companies set ticker = 'LBTYA', cik = '0001570585', markets = array['US'], exchange = 'Nasdaq' where id = 319 and ticker is null; -- T61 Liberty Global
update companies set ticker = 'BLK', cik = '0002012383', markets = array['US'], exchange = 'NYSE' where id = 343 and ticker is null; -- T62 BlackRock
update companies set ticker = 'ASTS', cik = '0001780312', markets = array['US'], exchange = 'Nasdaq' where id = 345 and ticker is null; -- T63 AST SpaceMobile
update companies set ticker = 'ACN', cik = '0001467373', markets = array['US'], exchange = 'NYSE' where id = 353 and ticker is null; -- T64 Accenture
update companies set ticker = 'NTNX', cik = '0001618732', markets = array['US'], exchange = 'Nasdaq' where id = 373 and ticker is null; -- T65 Nutanix
update companies set ticker = 'CVLT', cik = '0001169561', markets = array['US'], exchange = 'Nasdaq' where id = 381 and ticker is null; -- T66 Commvault
update companies set ticker = 'NOW', cik = '0001373715', markets = array['US'], exchange = 'NYSE' where id = 387 and ticker is null; -- T67 ServiceNow
update companies set ticker = 'HPQ', cik = '0000047217', markets = array['US'], exchange = 'NYSE' where id = 392 and ticker is null; -- T68 HP
update companies set ticker = 'DELL', cik = '0001571996', markets = array['US'], exchange = 'NYSE' where id = 397 and ticker is null; -- T69 Dell
update companies set ticker = 'RBRK', cik = '0001943896', markets = array['US'], exchange = 'NYSE' where id = 400 and ticker is null; -- T70 Rubrik
update companies set ticker = 'CHKP', cik = '0001015922', markets = array['US'], exchange = 'Nasdaq' where id = 401 and ticker is null; -- T71 Check Point
update companies set ticker = 'PANW', cik = '0001327567', markets = array['US'], exchange = 'Nasdaq' where id = 405 and ticker is null; -- T72 Palo Alto
update companies set ticker = 'CRWD', cik = '0001535527', markets = array['US'], exchange = 'Nasdaq' where id = 406 and ticker is null; -- T73 CrowdStrike
update companies set ticker = 'ZS', cik = '0001713683', markets = array['US'], exchange = 'Nasdaq' where id = 409 and ticker is null; -- T74 Zscaler
update companies set ticker = 'JOYY', cik = '0001530238', markets = array['US'], exchange = 'Nasdaq' where id = 485 and ticker is null; -- T75 JOYY
update companies set ticker = 'KC', cik = '0001795589', markets = array['US'], exchange = 'Nasdaq' where id = 487 and ticker is null; -- T76 Kingsoft Cloud
update companies set ticker = 'TCOM', cik = '0001269238', markets = array['US'], exchange = 'Nasdaq' where id = 494 and ticker is null; -- T77 Trip.com
update companies set ticker = 'BILI', cik = '0001723690', markets = array['US'], exchange = 'Nasdaq' where id = 502 and ticker is null; -- T78 Bilibili
update companies set ticker = 'IQ', cik = '0001722608', markets = array['US'], exchange = 'Nasdaq' where id = 503 and ticker is null; -- T79 iQIYI
update companies set ticker = 'BABA', cik = '0001577552', markets = array['US'], exchange = 'NYSE' where id = 507 and ticker is null; -- T80 Alibaba

-- X1: Delivery Hero, checked on Deutsche Börse (Symbol DHER, ISIN DE000A2E4K43, Xetra). markets stays empty.
update companies set ticker = 'DHER', exchange = 'Xetra' where id = 32 and ticker is null;
-- X3: Didi, from the SEC list (OTC DIDIY, CIK 1764757). OTC is not a primary market, so markets stays empty.
update companies set ticker = 'DIDIY', cik = '0001764757', exchange = 'OTC', entity_type = 'public_company' where id = 36 and ticker is null;

-- A1-A3: search aliases.
update companies set aliases = aliases || array['TSMC'] where id = 9 and not ('TSMC' = any(aliases));
update companies set aliases = aliases || array['Facebook'] where id = 4 and not ('Facebook' = any(aliases));
update companies set aliases = aliases || array['Meta'] where id = 4 and not ('Meta' = any(aliases));

-- D: merges. Links move to the kept company; evidence rows stay with their links. The merged name becomes an alias.
-- D9 first: link 672 (Youku competes with iQIYI) must keep source_id < target_id for 'competes', so its ends swap: iQIYI (503) -> Alibaba (507).
update relationships set source_id = 503, target_id = 507, note = 'via Youku' where id = 672 and source_id = 482 and target_id = 503;
-- D1 Alibaba Cloud (486) -> Alibaba (507); link 667 keeps the unit as "via".
update relationships set note = 'via Alibaba Cloud' where id = 667 and note is null;
-- D2 Tencent Video (497) -> Tencent (480); link 671 keeps the unit as "via".
update relationships set note = 'via Tencent Video' where id = 671 and note is null;
-- D10: link 486 (sponsorship, 2020, as amended 2022) repeats link 488 (the arrangement extended to 2045) once both point at AMR GP; rejected as a historical sponsor artifact.
update relationships set status = 'rejected', note = 'Admin review 2026-11-04 (DAT-8 D10): duplicate of 488 after merging the F1 team into AMR GP' where id = 486 and status = 'promoted';
-- D12: links 426 and 442 are the same Telekom Romania deal; 426 is rejected.
update relationships set status = 'rejected', note = 'Admin review 2026-11-04 (DAT-8 D12): duplicate of 442 after merging Telekom Romania' where id = 426 and status = 'promoted';

-- Repoint every remaining link of each merged company (keep id <- merged id).
update relationships set source_id = case source_id when 486 then 507 when 482 then 507 when 497 then 480 when 341 then 334 when 445 then 433 when 479 then 456 when 275 then 362 when 367 then 370 when 368 then 370 when 455 then 436 when 318 then 337 when 371 then 320 end
  where source_id in (486, 482, 497, 341, 445, 479, 275, 367, 368, 455, 318, 371);
update relationships set target_id = case target_id when 486 then 507 when 482 then 507 when 497 then 480 when 341 then 334 when 445 then 433 when 479 then 456 when 275 then 362 when 367 then 370 when 368 then 370 when 455 then 436 when 318 then 337 when 371 then 320 end
  where target_id in (486, 482, 497, 341, 445, 479, 275, 367, 368, 455, 318, 371);

-- Merged names become aliases of the kept company.
update companies set aliases = aliases || array['Alibaba Cloud', 'Youku'] where id = 507 and not ('Alibaba Cloud' = any(aliases));
update companies set aliases = aliases || array['Tencent Video'] where id = 480 and not ('Tencent Video' = any(aliases));
update companies set aliases = aliases || array['Oak Holdings 1 GmbH'] where id = 334 and not ('Oak Holdings 1 GmbH' = any(aliases));
update companies set aliases = aliases || array['Alliance Automotive Research & Development (Shanghai)'] where id = 433 and not ('Alliance Automotive Research & Development (Shanghai)' = any(aliases));
update companies set aliases = aliases || array['Roads and Transport Authority in Dubai', 'RTA'] where id = 456 and not ('RTA' = any(aliases));
update companies set aliases = aliases || array['PIF'] where id = 362 and not ('PIF' = any(aliases));
update companies set aliases = aliases || array['Aston Martin Cognizant Formula One team', 'Aston Martin Aramco Formula One Team'] where id = 370 and not ('Aston Martin Aramco Formula One Team' = any(aliases));
update companies set aliases = aliases || array['Yuji'] where id = 436 and not ('Yuji' = any(aliases));
update companies set aliases = aliases || array['Telekom Romania Mobile Communications'] where id = 337 and not ('Telekom Romania Mobile Communications' = any(aliases));
update companies set aliases = aliases || array['Ziggo Group'] where id = 320 and not ('Ziggo Group' = any(aliases));

-- Delete the merged companies, only if no link still points at them.
delete from companies c where c.id in (486, 482, 497, 341, 445, 479, 275, 367, 368, 455, 318, 371)
  and not exists (select 1 from relationships r where r.source_id = c.id or r.target_id = c.id);

-- F1: link 704's quote is Lenovo's report ("the Group held 95.10%"), so the investor is Lenovo, not NEC.
update relationships set source_id = 374, note = 'Admin review 2026-11-04 (DAT-8 F1): source corrected from NEC to Lenovo per quote' where id = 704 and source_id = 522;

-- N1-N6, N8-N12, N16-N18: no current listing found; type changes to private_company. Links keep their own dates.
-- (N13-N15 are merged above.)
update companies set entity_type = 'private_company'
  where id in (121, 174, 162, 200, 407, 117, 157, 57, 152, 172, 446, 323, 229, 247) and entity_type = 'public_company';

commit;

-- Checks to run after commit (expected results in comments).
select count(*) as us_tickers_added from companies where markets = array['US'] and cik is not null
  and id in (28,29,55,66,88,93,95,105,116,123,124,125,126,127,129,130,131,134,141,148,149,155,164,167,168,170,176,177,178,184,187,193,197,199,201,205,206,208,209,210,211,212,213,214,216,218,219,220,221,223,224,225,226,237,249,254,297,298,299,300,319,343,345,353,373,381,387,392,397,400,401,405,406,409,485,487,494,502,503,507); -- 80
select count(*) as merged_left from companies where id in (486, 482, 497, 341, 445, 479, 275, 367, 368, 455, 318, 371); -- 0
select id, source_id, target_id, relationship_type, status, note from relationships where id in (426, 486, 667, 671, 672, 704) order by id;
select id, name, aliases from companies where id in (4, 9, 320, 334, 337, 362, 370, 433, 436, 456, 480, 507) order by id;
