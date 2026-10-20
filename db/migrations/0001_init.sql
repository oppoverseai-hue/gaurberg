-- Gaurberg data contract v1 (provisional until the M2 UBER spike). Not yet applied.
create table companies (
  id bigserial primary key,
  ticker text unique not null,
  name text not null,
  cik text,
  segment text check (segment in ('consumer','business','infrastructure')),
  size_tier text check (size_tier in ('large','mid','small')),
  is_seed boolean default false,
  is_hero boolean default false,
  created_at timestamptz default now()
);
create table agent_runs (
  id bigserial primary key,
  agent text not null,
  company_id bigint references companies(id),
  model text, tokens_in int, tokens_out int, cost_usd numeric default 0,
  status text, started_at timestamptz default now(), finished_at timestamptz
);
create table relationships (
  id bigserial primary key,
  source_id bigint not null references companies(id),
  target_id bigint not null references companies(id),
  relationship_type text not null check (relationship_type in ('supplies','sells_to','partners','competes','invests')),
  exposure_pct numeric,
  exposure_basis text check (exposure_basis in ('source_revenue','target_cost','ownership','none')),
  exposure_qualifier text check (exposure_qualifier in ('exact','at_least','approximate')),
  exposure_as_of date,
  confidence numeric,
  trust_status text check (trust_status in ('verified','curated','live_generated','sample')),
  source_type text check (source_type in ('sec_filing','press_release','news','manual','dummy')),
  status text not null default 'staged' check (status in ('staged','promoted','rejected','live')),
  run_id bigint references agent_runs(id),
  as_of_date date,
  created_at timestamptz default now(),
  -- partners and competes stored once, lower id as source
  check (relationship_type not in ('partners','competes') or source_id < target_id)
);
create table evidence (
  id bigserial primary key,
  relationship_id bigint not null references relationships(id) on delete cascade,
  url text, quote text, quote_found boolean, published_at timestamptz
);
create table verification_results (
  id bigserial primary key,
  relationship_id bigint not null references relationships(id) on delete cascade,
  stage text, verdict text, model text, reason text, created_at timestamptz default now()
);
create table holdings (
  id bigserial primary key, company_id bigint references companies(id),
  holder text, shares numeric, value_usd numeric, period date, source_url text
);
create table insider_trades (
  id bigserial primary key, company_id bigint references companies(id),
  insider text, role text, tx_type text, shares numeric, price numeric, tx_date date, source_url text
);
create table price_cache (
  company_id bigint references companies(id), ts timestamptz, close numeric, volume numeric,
  primary key (company_id, ts)
);
create table gold_edges (
  id bigserial primary key, focal_ticker text, counterparty text, relationship_type text,
  direction text, evidence_url text, quote text, as_of date, label text,
  exposure_pct numeric, exposure_basis text, exposure_qualifier text, notes text
);
create table eval_results (
  id bigserial primary key, run_id bigint references agent_runs(id), test_id text,
  metric text, value numeric, threshold numeric, passed boolean, created_at timestamptz default now()
);
create table allowlist (
  email text primary key, role text not null check (role in ('admin','reviewer')), created_at timestamptz default now()
);
create table lookup_log (
  id bigserial primary key, email text, query text, created_at timestamptz default now()
);
create table lookup_queue (
  id bigserial primary key, email text, query text, status text default 'queued', created_at timestamptz default now()
);

-- RLS sketch: only allowlisted users read; only promoted/live/sample edges are visible to reviewers.
alter table companies enable row level security;
alter table relationships enable row level security;
alter table evidence enable row level security;
alter table allowlist enable row level security;
create policy read_companies on companies for select
  using (exists (select 1 from allowlist a where a.email = auth.jwt()->>'email'));
create policy read_relationships on relationships for select
  using (status in ('promoted','live') and exists (select 1 from allowlist a where a.email = auth.jwt()->>'email'));
create policy read_evidence on evidence for select
  using (exists (select 1 from allowlist a where a.email = auth.jwt()->>'email'));
