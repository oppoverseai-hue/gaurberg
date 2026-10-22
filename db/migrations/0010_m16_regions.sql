-- M16: where a company earns its revenue, by country, and a generic country -> region lookup that works for every company.
-- Region is never typed onto a company. It is derived from the country, so the grouping can change without re-extracting anything.
-- Six regions (admin approved 2026-10-22): North America, Latin America, Europe, MENA, Sub-Saharan Africa, APAC (includes India).
-- Rows are staged until an admin promotes them. A gap stays a gap: if a report gives no split, there is no row (no estimates).

create table if not exists public.country_region (
  country text primary key check (country ~ '^[A-Z]{2}$'),
  country_name text not null,
  region text not null check (region in ('North America','Latin America','Europe','MENA','Sub-Saharan Africa','APAC'))
);

insert into public.country_region(country, country_name, region) values
 ('US','United States','North America'),('CA','Canada','North America'),
 ('MX','Mexico','Latin America'),('BR','Brazil','Latin America'),('AR','Argentina','Latin America'),('CL','Chile','Latin America'),('CO','Colombia','Latin America'),('PE','Peru','Latin America'),
 ('GB','United Kingdom','Europe'),('IE','Ireland','Europe'),('DE','Germany','Europe'),('FR','France','Europe'),('IT','Italy','Europe'),('ES','Spain','Europe'),('PT','Portugal','Europe'),
 ('NL','Netherlands','Europe'),('BE','Belgium','Europe'),('LU','Luxembourg','Europe'),('CH','Switzerland','Europe'),('AT','Austria','Europe'),('SE','Sweden','Europe'),('NO','Norway','Europe'),
 ('DK','Denmark','Europe'),('FI','Finland','Europe'),('PL','Poland','Europe'),('CZ','Czechia','Europe'),('HU','Hungary','Europe'),('RO','Romania','Europe'),('GR','Greece','Europe'),
 ('TR','Turkey','Europe'),('RU','Russia','Europe'),('UA','Ukraine','Europe'),('AL','Albania','Europe'),('HR','Croatia','Europe'),('MT','Malta','Europe'),('CY','Cyprus','Europe'),
 ('AE','United Arab Emirates','MENA'),('SA','Saudi Arabia','MENA'),('QA','Qatar','MENA'),('KW','Kuwait','MENA'),('BH','Bahrain','MENA'),('OM','Oman','MENA'),('EG','Egypt','MENA'),
 ('MA','Morocco','MENA'),('DZ','Algeria','MENA'),('TN','Tunisia','MENA'),('JO','Jordan','MENA'),('IL','Israel','MENA'),('IQ','Iraq','MENA'),('LB','Lebanon','MENA'),
 ('ZA','South Africa','Sub-Saharan Africa'),('KE','Kenya','Sub-Saharan Africa'),('NG','Nigeria','Sub-Saharan Africa'),('TZ','Tanzania','Sub-Saharan Africa'),('MZ','Mozambique','Sub-Saharan Africa'),
 ('CD','DR Congo','Sub-Saharan Africa'),('LS','Lesotho','Sub-Saharan Africa'),('GH','Ghana','Sub-Saharan Africa'),('ET','Ethiopia','Sub-Saharan Africa'),('UG','Uganda','Sub-Saharan Africa'),
 ('CN','China','APAC'),('HK','Hong Kong','APAC'),('TW','Taiwan','APAC'),('JP','Japan','APAC'),('KR','South Korea','APAC'),('IN','India','APAC'),('PK','Pakistan','APAC'),('BD','Bangladesh','APAC'),
 ('LK','Sri Lanka','APAC'),('SG','Singapore','APAC'),('MY','Malaysia','APAC'),('TH','Thailand','APAC'),('ID','Indonesia','APAC'),('PH','Philippines','APAC'),('VN','Vietnam','APAC'),
 ('AU','Australia','APAC'),('NZ','New Zealand','APAC'),('MO','Macau','APAC')
on conflict (country) do nothing;

create table if not exists public.company_geo_revenue (
  id bigserial primary key,
  company_id bigint not null references public.companies(id) on delete cascade,
  country text,                                   -- ISO 2-letter code from country_region, or null for a bucket the report names but does not break down
  label text not null,                            -- the name exactly as the report states it ("Germany", "Rest of world", "Other Europe")
  bucket_region text check (bucket_region in ('North America','Latin America','Europe','MENA','Sub-Saharan Africa','APAC')),  -- only for a named bucket that clearly sits inside one region
  revenue_pct numeric check (revenue_pct >= 0 and revenue_pct <= 100),
  revenue_amount numeric,                         -- as stated, in currency units named below
  currency text,
  unit text,                                      -- "m" or "bn" as the report states it
  period_end date not null,
  pct_basis text not null default 'stated' check (pct_basis in ('stated','computed')),  -- computed = amount / total stated in the same table; never an estimate
  source_type text not null default 'annual_report' check (source_type in ('sec_filing','annual_report','press_release','news','manual','dummy')),
  status text not null default 'staged' check (status in ('staged','promoted','rejected','live')),
  trust_status text check (trust_status in ('verified','curated','live_generated','sample')),
  run_id bigint,
  section text,
  quote text,
  quote_found boolean,
  note text,
  created_at timestamptz not null default now(),
  check (country is not null or bucket_region is not null or label ~* '(other|rest|unallocated|total)'),
  check (revenue_pct is not null or revenue_amount is not null)
);
create index if not exists company_geo_revenue_company_idx on public.company_geo_revenue(company_id, period_end desc);
create index if not exists company_geo_revenue_country_idx on public.company_geo_revenue(country);

alter table public.country_region enable row level security;
alter table public.company_geo_revenue enable row level security;
create policy country_region_read on public.country_region for select to authenticated using (public.is_allowed());
create policy company_geo_revenue_read on public.company_geo_revenue for select to authenticated
  using (public.is_admin() or (public.is_allowed() and status in ('promoted','live')));

-- Region view: one row per company, region and period, summing the countries that map to the region. Bucket-only rows add to their stated region.
create or replace view public.company_region_revenue with (security_invoker = true) as
select g.company_id, coalesce(cr.region, g.bucket_region) as region, g.period_end,
       sum(g.revenue_pct) as revenue_pct, sum(g.revenue_amount) as revenue_amount, max(g.currency) as currency,
       bool_or(g.country is null) as includes_bucket, count(*) as rows_used
from public.company_geo_revenue g
left join public.country_region cr on cr.country = g.country
where g.status in ('promoted','live') and coalesce(cr.region, g.bucket_region) is not null
group by g.company_id, coalesce(cr.region, g.bucket_region), g.period_end;
