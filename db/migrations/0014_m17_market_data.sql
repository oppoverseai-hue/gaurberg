-- M17 (DEM-1): market-data tables loaded by agents/market_data/load_fundamentals.py from Finnhub's free plan (US listings only).
-- These are market-data tables, separate from the promoted-edge tables: they never write companies or relationships.
-- Rows are staged until an admin promotes them. A missing value is NULL, never an estimate; analyst EPS and revenue estimates are not stored.

create table if not exists public.company_metrics (
  id bigserial primary key,
  company_id bigint not null references public.companies(id) on delete cascade,
  as_of date not null,                  -- the day the values were fetched (UTC)
  data_period date,                     -- latest quarter end Finnhub's TTM figures reflect (from series.quarterly), when given
  pe_ttm numeric,
  ev_ebitda numeric,                    -- TTM
  gross_margin numeric,                 -- percent, TTM
  net_margin numeric,                   -- percent, TTM
  revenue_growth_yoy numeric,           -- percent, TTM vs prior TTM
  debt_to_equity numeric,               -- total debt / total equity, latest quarter
  rec_period date,                      -- recommendation trends: latest month Finnhub reports
  rec_strong_buy int, rec_buy int, rec_hold int, rec_sell int, rec_strong_sell int,
  source text not null default 'finnhub',
  fetched_at timestamptz not null default now(),
  status text not null default 'staged' check (status in ('staged','promoted','rejected')),
  run_id bigint references public.agent_runs(id),
  note text,                            -- which fields came back empty, and why
  unique (company_id, as_of, source)
);

create table if not exists public.company_events (
  id bigserial primary key,
  company_id bigint not null references public.companies(id) on delete cascade,
  event_date date not null,
  event_type text not null check (event_type in ('earnings')),
  detail text,                          -- e.g. "Q3 2026, before market open"; no estimates
  source text not null default 'finnhub',
  fetched_at timestamptz not null default now(),
  status text not null default 'staged' check (status in ('staged','promoted','rejected')),
  run_id bigint references public.agent_runs(id),
  unique (company_id, event_date, event_type, source)
);
create index if not exists company_events_company_idx on public.company_events(company_id, event_date);

alter table public.company_metrics enable row level security;
alter table public.company_events enable row level security;
create policy company_metrics_read on public.company_metrics for select to authenticated
  using (public.is_admin() or (public.is_allowed() and status = 'promoted'));
create policy company_events_read on public.company_events for select to authenticated
  using (public.is_admin() or (public.is_allowed() and status = 'promoted'));
