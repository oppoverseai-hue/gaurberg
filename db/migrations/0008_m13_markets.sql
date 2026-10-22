-- M13: market tag for companies (London and Hong Kong expansion).
-- markets is a list because a company can trade in more than one market (for example WeRide: US and HKEX).
-- exchange and country stay empty until a source document states them. Nothing is guessed.
alter table public.companies
  add column if not exists markets text[] not null default '{}',
  add column if not exists exchange text,
  add column if not exists country text;

alter table public.companies
  drop constraint if exists companies_markets_check;
alter table public.companies
  add constraint companies_markets_check check (markets <@ array['US','LSE','HKEX']::text[]);

-- Backfill: every company that already has a ticker was loaded from the US universe (SEC filers).
-- Companies without a ticker keep an empty list (unknown) until a later milestone sets them.
update public.companies
set markets = array['US']
where ticker is not null and markets = '{}';

create index if not exists companies_markets_gin on public.companies using gin (markets);
