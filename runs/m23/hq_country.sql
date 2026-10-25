-- M23: HQ country for the 25 US-listed seed companies that have none (companies.country is null). Prepared 2026-10-25; NOT run by Claude.
-- Source for every value: the filer's business address in SEC EDGAR (data.sec.gov/submissions/CIK<cik>.json, addresses.business),
-- read 2026-10-25. A US state maps to US; foreign filers give the country (Grab: Singapore, Nebius: Netherlands, TSMC: Taiwan).
-- Used only as the HQ fallback for the Comps region filter when a company has no revenue-by-region rows. Never a revenue split.
-- Guarded: only fills a blank country and only for the expected ticker. Run once in the Supabase SQL editor; prints the rows after.
update public.companies c set country = v.cc
from (values
  ('AAPL', 'US'),  -- CIK 320193, Apple Inc.: Cupertino, CA
  ('AMD', 'US'),  -- CIK 2488, ADVANCED MICRO DEVICES INC: Santa Clara, CA
  ('AMZN', 'US'),  -- CIK 1018724, AMAZON COM INC: Seattle, WA
  ('APLD', 'US'),  -- CIK 1144879, Applied Digital Corp.: Dallas, TX
  ('AUR', 'US'),  -- CIK 1828108, Aurora Innovation, Inc.: Pittsburgh, PA
  ('CART', 'US'),  -- CIK 1579091, Maplebear Inc.: San Francisco, CA
  ('CBRS', 'US'),  -- CIK 2021728, Cerebras Systems Inc.: Sunnyvale, CA
  ('CRWV', 'US'),  -- CIK 1769628, CoreWeave, Inc.: Livingston, NJ
  ('DASH', 'US'),  -- CIK 1792789, DoorDash, Inc.: San Francisco, CA
  ('GOOGL', 'US'),  -- CIK 1652044, Alphabet Inc.: Mountain View, CA
  ('GRAB', 'SG'),  -- CIK 1855612, Grab Holdings Ltd: Singapore
  ('INTC', 'US'),  -- CIK 50863, INTEL CORP: Santa Clara, CA
  ('LCID', 'US'),  -- CIK 1811210, Lucid Group, Inc.: Newark, CA
  ('LIME', 'US'),  -- CIK 1699963, Neutron Holdings, Inc.: San Francisco, CA
  ('LYFT', 'US'),  -- CIK 1759509, Lyft, Inc.: San Francisco, CA
  ('META', 'US'),  -- CIK 1326801, Meta Platforms, Inc.: Menlo Park, CA
  ('MSFT', 'US'),  -- CIK 789019, MICROSOFT CORP: Redmond, WA
  ('NBIS', 'NL'),  -- CIK 1513845, Nebius Group N.V.: Amsterdam, Netherlands
  ('NET', 'US'),  -- CIK 1477333, Cloudflare, Inc.: San Francisco, CA
  ('NVDA', 'US'),  -- CIK 1045810, NVIDIA CORP: Santa Clara, CA
  ('ORCL', 'US'),  -- CIK 1341439, ORACLE CORP: Austin, TX
  ('PLTR', 'US'),  -- CIK 1321655, Palantir Technologies Inc.: Aventura, FL
  ('TSLA', 'US'),  -- CIK 1318605, Tesla, Inc.: Austin, TX
  ('TSM', 'TW'),  -- CIK 1046179, TAIWAN SEMICONDUCTOR MANUFACTURING CO LTD: Hsinchu, Taiwan
  ('UBER', 'US')  -- CIK 1543151, Uber Technologies, Inc: San Francisco, CA
) v(ticker, cc)
where c.ticker = v.ticker and c.is_seed and c.country is null;

select c.ticker, c.name, c.country, r.region from public.companies c left join public.country_region r on r.country = c.country
where c.is_seed and c.ticker is not null order by r.region nulls first, c.ticker;
