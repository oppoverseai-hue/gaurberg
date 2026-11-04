-- DAT-8: staged SQL for exactly the admin's final decisions (Nov 4, 2026, "supersedes all earlier pastes").
-- The admin runs this in the Supabase SQL editor. It writes promoted tables (companies, relationships).
-- Each statement is guarded, so it changes nothing if a row already differs from what was reviewed.
-- Not included, with reasons, in decisions_2026-11-04.md: D13 (held: Ziggo Group is not VodafoneZiggo), and the X rows
-- that could not be confirmed on the exchange's own site.
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

-- X3: Didi, from the SEC list (OTC DIDIY, CIK 1764757). markets stays empty (OTC is not a primary market).
update companies set ticker = 'DIDIY', cik = '0001764757', exchange = 'OTC', entity_type = 'public_company' where id = 36 and ticker is null;

-- X4-X16: HKEX, markets = ['HKEX'] (admin: Keep).
update companies set ticker = '0700.HK', markets = array['HKEX'], exchange = 'HKEX' where id = 480 and ticker is null; -- X4 Tencent
update companies set ticker = '3690.HK', markets = array['HKEX'], exchange = 'HKEX' where id = 466 and ticker is null; -- X5 Meituan
update companies set ticker = '1810.HK', markets = array['HKEX'], exchange = 'HKEX' where id = 488 and ticker is null; -- X6 Xiaomi
update companies set ticker = '0001.HK', markets = array['HKEX'], exchange = 'HKEX' where id = 331 and ticker is null; -- X7 CK Hutchison
update companies set ticker = '0175.HK', markets = array['HKEX'], exchange = 'HKEX' where id = 361 and ticker is null; -- X8 Geely
update companies set ticker = '0981.HK', markets = array['HKEX'], exchange = 'HKEX' where id = 180 and ticker is null; -- X9 SMIC
update companies set ticker = '2238.HK', markets = array['HKEX'], exchange = 'HKEX' where id = 435 and ticker is null; -- X10 GAC
update companies set ticker = '0598.HK', markets = array['HKEX'], exchange = 'HKEX' where id = 473 and ticker is null; -- X11 Sinotrans
update companies set ticker = '1958.HK', markets = array['HKEX'], exchange = 'HKEX' where id = 475 and ticker is null; -- X12 BAIC
update companies set ticker = '0728.HK', markets = array['HKEX'], exchange = 'HKEX' where id = 492 and ticker is null; -- X13 China Telecom
update companies set ticker = '0762.HK', markets = array['HKEX'], exchange = 'HKEX' where id = 495 and ticker is null; -- X14 China Unicom
update companies set ticker = '0941.HK', markets = array['HKEX'], exchange = 'HKEX' where id = 498 and ticker is null; -- X15 China Mobile
update companies set ticker = '3396.HK', markets = array['HKEX'], exchange = 'HKEX' where id = 510 and ticker is null; -- X16 Legend Holdings

-- X19, X21, X22: LSE, markets = ['LSE'] (admin: Keep).
update companies set ticker = 'BA.L', markets = array['LSE'], exchange = 'LSE' where id = 304 and ticker is null; -- X19 BAE Systems
update companies set ticker = 'ZEG.L', markets = array['LSE'], exchange = 'LSE' where id = 321 and ticker is null; -- X21 Zegona
update companies set ticker = 'MNG.L', markets = array['LSE'], exchange = 'LSE' where id = 421 and ticker is null; -- X22 M&G

-- X1 and the conditional X rows, each confirmed on the exchange's own site on Nov 4, 2026. markets stays empty.
update companies set ticker = 'DHER.DE', exchange = 'Xetra' where id = 32 and ticker is null; -- X1 Delivery Hero (Deutsche Börse: DHER, DE000A2E4K43)
update companies set ticker = 'AMV0.DE', exchange = 'Xetra' where id = 94 and ticker is null; -- X24 AUMOVIO (Deutsche Börse: AMV0, DE000AUM0V10)
update companies set ticker = '1U1.DE', exchange = 'Xetra' where id = 324 and ticker is null; -- X25 1&1 (Deutsche Börse: 1U1, DE0005545503)
update companies set ticker = 'ADYEN.AS', exchange = 'Euronext Amsterdam' where id = 228 and ticker is null; -- X26 Adyen (Euronext: ADYEN, NL0012969182)
update companies set ticker = 'PRX.AS', exchange = 'Euronext Amsterdam' where id = 151 and ticker is null; -- X27 Prosus (Euronext: PRX, NL0013654783)
update companies set ticker = 'RNO.PA', exchange = 'Euronext Paris' where id = 438 and ticker is null; -- X28 Renault (Euronext: RNO, FR0000131906)
update companies set ticker = 'ABBN.SW', exchange = 'SIX Swiss Exchange' where id = 215 and ticker is null; -- X29 ABB (SIX: ABBN, CH0012221716)
update companies set ticker = 'SCMN.SW', exchange = 'SIX Swiss Exchange' where id = 350 and ticker is null; -- X30 Swisscom (SIX: SCMN, CH0008742519)
update companies set ticker = 'TEL.OL', exchange = 'Oslo Børs' where id = 330 and ticker is null; -- X31 Telenor (Euronext: TEL, NO0010063308, Oslo Børs)
update companies set ticker = 'VOLV-B.ST', exchange = 'Nasdaq Stockholm' where id = 90 and ticker is null; -- X32 AB Volvo (Nasdaq: VOLV B; link 83 is about trucks)
update companies set ticker = '2317.TW', exchange = 'TWSE' where id = 128 and ticker is null; -- X44 Hon Hai (TWSE list)
update companies set ticker = '3231.TW', exchange = 'TWSE' where id = 122 and ticker is null; -- X45 Wistron (TWSE list)
update companies set ticker = '2454.TW', exchange = 'TWSE' where id = 183 and ticker is null; -- X46 MediaTek (TWSE list)
update companies set ticker = '2449.TW', exchange = 'TWSE' where id = 173 and ticker is null; -- X47 KYEC (TWSE list)
update companies set ticker = '3443.TW', exchange = 'TWSE' where id = 192 and ticker is null; -- X48 GUC (TWSE list)
update companies set ticker = '2324.TW', exchange = 'TWSE' where id = 519 and ticker is null; -- X49 Compal (TWSE list)
update companies set ticker = '5347.TWO', exchange = 'TPEx' where id = 190 and ticker is null; -- X50 VIS (TPEx: Vanguard International Semiconductor)
update companies set ticker = '3374.TWO', exchange = 'TPEx' where id = 191 and ticker is null; -- X51 Xintec (TPEx: Xintec Inc.)
update companies set ticker = 'EMTK.JK', exchange = 'Indonesia Stock Exchange' where id = 246 and ticker is null; -- X60 Emtek (IDX: Elang Mahkota Teknologi)
update companies set ticker = 'SCOM.NR', exchange = 'Nairobi Securities Exchange' where id = 317 and ticker is null; -- X61 Safaricom (NSE list: SCOM, KE1000001402)
update companies set ticker = 'TPG.AX', exchange = 'ASX' where id = 336 and ticker is null; -- X62 TPG Telecom (ASX: TPG TELECOM LIMITED)

-- A1-A3: search aliases.
update companies set aliases = aliases || array['TSMC'] where id = 9 and not ('TSMC' = any(aliases));
update companies set aliases = aliases || array['Facebook'] where id = 4 and not ('Facebook' = any(aliases));
update companies set aliases = aliases || array['Meta'] where id = 4 and not ('Meta' = any(aliases));

-- D merges (D1, D2, D5-D12). Links move to the kept company; evidence stays with its link; no link is rejected except 442 (D12).
-- D9 first: link 672 (Youku competes with iQIYI) must keep source_id < target_id for 'competes', so its ends swap to iQIYI (503) -> Alibaba (507).
update relationships set source_id = 503, target_id = 507, note = 'via Youku' where id = 672 and source_id = 482 and target_id = 503;
update relationships set note = 'via Alibaba Cloud' where id = 667 and note is null; -- D1
update relationships set note = 'via Tencent Video' where id = 671 and note is null; -- D2
-- D12: links 426 and 442 are the same Telekom Romania deal; the admin keeps 426 and rejects 442.
update relationships set status = 'rejected', note = 'Admin review 2026-11-04 (DAT-8 D12): same deal as 426' where id = 442 and status = 'promoted';

update relationships set source_id = case source_id when 486 then 507 when 482 then 507 when 497 then 480 when 341 then 334 when 445 then 433 when 479 then 456 when 275 then 362 when 367 then 370 when 368 then 370 when 455 then 436 when 318 then 337 end
  where source_id in (486, 482, 497, 341, 445, 479, 275, 367, 368, 455, 318);
update relationships set target_id = case target_id when 486 then 507 when 482 then 507 when 497 then 480 when 341 then 334 when 445 then 433 when 479 then 456 when 275 then 362 when 367 then 370 when 368 then 370 when 455 then 436 when 318 then 337 end
  where target_id in (486, 482, 497, 341, 445, 479, 275, 367, 368, 455, 318);

update companies set aliases = aliases || array['Alibaba Cloud', 'Youku'] where id = 507 and not ('Alibaba Cloud' = any(aliases));
update companies set aliases = aliases || array['Tencent Video'] where id = 480 and not ('Tencent Video' = any(aliases));
update companies set aliases = aliases || array['Oak Holdings 1 GmbH'] where id = 334 and not ('Oak Holdings 1 GmbH' = any(aliases));
update companies set aliases = aliases || array['Alliance Automotive Research & Development (Shanghai)'] where id = 433 and not ('Alliance Automotive Research & Development (Shanghai)' = any(aliases));
update companies set aliases = aliases || array['Roads and Transport Authority in Dubai', 'RTA'] where id = 456 and not ('RTA' = any(aliases));
update companies set aliases = aliases || array['PIF'] where id = 362 and not ('PIF' = any(aliases));
update companies set aliases = aliases || array['Aston Martin Cognizant Formula One team', 'Aston Martin Aramco Formula One Team'] where id = 370 and not ('Aston Martin Aramco Formula One Team' = any(aliases));
update companies set aliases = aliases || array['Yuji'] where id = 436 and not ('Yuji' = any(aliases));
update companies set aliases = aliases || array['Telekom Romania Mobile Communications'] where id = 337 and not ('Telekom Romania Mobile Communications' = any(aliases));

-- Delete the merged companies (D) and the empty BT node (D3: keep 422 BT Services), only if no link points at them.
delete from companies c where c.id in (486, 482, 497, 341, 445, 479, 275, 367, 368, 455, 318, 386)
  and not exists (select 1 from relationships r where r.source_id = c.id or r.target_id = c.id);

-- F1: link 704's quote is Lenovo's report ("the Group held 95.10%"), so the investor is Lenovo, not NEC.
update relationships set source_id = 374, note = 'Admin review 2026-11-04 (DAT-8 F1): source corrected from NEC to Lenovo per quote' where id = 704 and source_id = 522;

-- N1-N6, N8-N12: no current listing; type becomes private_company, no ticker. (N13-N15 are merged above.)
update companies set entity_type = 'private_company'
  where id in (121, 174, 162, 200, 407, 117, 157, 57, 152, 172, 446) and entity_type = 'public_company';

commit;

-- After-counts check. Expected values are in the comments; "before" was read on Nov 4, 2026.
select (select count(*) from companies) companies,                                    -- before 489, after 477
       (select count(*) from companies where ticker is not null) with_ticker,             -- before 45, after 163
       (select count(*) from companies where 'US' = any(markets)) mkt_us,                 -- before 40, after 120
       (select count(*) from companies where 'HKEX' = any(markets)) mkt_hkex,             -- before 4, after 17
       (select count(*) from companies where 'LSE' = any(markets)) mkt_lse,               -- before 5, after 8
       (select count(*) from companies where cik is not null) with_cik,                   -- before 1, after 82
       (select count(*) from companies where cardinality(aliases) > 0) with_aliases,      -- before 5, after 16
       (select count(*) from relationships where status = 'promoted') rel_promoted,       -- before 611, after 610
       (select count(*) from relationships where status = 'rejected') rel_rejected,       -- before 60, after 61
       (select count(*) from relationships where status = 'live') rel_live,               -- before 34, after 34
       (select count(*) from evidence) evidence;                                          -- before 1013, after 1013
select entity_type, count(*) from companies group by 1 order by 1;
-- before: institution 20, organization 11, private_company 246, public_company 209, segment_group 3
-- after:  institution 18, organization 11, private_company 250, public_company 195, segment_group 3
