-- M2: remaining data tables. Companies gains private/segment nodes (entity_type, aliases).
alter table public.companies alter column ticker drop not null;
alter table public.companies add column if not exists entity_type text not null default 'public_company'
  check (entity_type in ('public_company','private_company','segment_group','institution','organization'));
alter table public.companies add column if not exists aliases text[] not null default '{}';

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.allowlist a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email','')) and a.role = 'admin');
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create table public.agent_runs (
  id bigserial primary key,
  agent_name text not null,
  mode text not null default 'batch' check (mode in ('batch','live')),
  target text, model text, tokens_in int, tokens_out int, cost_usd numeric not null default 0,
  started_at timestamptz not null default now(), finished_at timestamptz,
  status text, review_status text default 'unreviewed', reviewer text
);

create table public.relationships (
  id bigserial primary key,
  source_id bigint not null references public.companies(id),
  target_id bigint not null references public.companies(id),
  relationship_type text not null check (relationship_type in ('supplies','sells_to','partners','competes','invests')),
  exposure_pct numeric,
  exposure_basis text check (exposure_basis in ('source_revenue','target_cost','ownership','none')),
  exposure_qualifier text check (exposure_qualifier in ('exact','at_least','approximate')),
  exposure_as_of date,
  confidence numeric,
  trust_status text check (trust_status in ('verified','curated','live_generated','sample')),
  source_type text check (source_type in ('sec_filing','press_release','news','manual','dummy')),
  status text not null default 'staged' check (status in ('staged','promoted','rejected','live')),
  run_id bigint references public.agent_runs(id),
  as_of_date date,
  note text,
  created_at timestamptz not null default now(),
  check (source_id <> target_id),
  check (relationship_type not in ('partners','competes') or source_id < target_id)
);
create index relationships_source_idx on public.relationships(source_id);
create index relationships_target_idx on public.relationships(target_id);

create table public.evidence (
  id bigserial primary key,
  relationship_id bigint not null references public.relationships(id) on delete cascade,
  document_url text, section text, quote text, quote_found boolean, published_at date
);

create table public.verification_results (
  id bigserial primary key,
  relationship_id bigint not null references public.relationships(id) on delete cascade,
  stage text, verdict text, model text, reason text, created_at timestamptz not null default now()
);

create table public.holdings (
  id bigserial primary key, company_id bigint references public.companies(id),
  holder text, shares numeric, value_usd numeric, period date, source_url text
);
create table public.insider_trades (
  id bigserial primary key, company_id bigint references public.companies(id),
  insider text, role text, tx_type text, shares numeric, price numeric, tx_date date, source_url text
);
create table public.gold_edges (
  id bigserial primary key, focal_ticker text, counterparty text, relationship_type text, direction text,
  evidence_url text, quote text, as_of date, label text, exposure_pct numeric, exposure_basis text,
  exposure_qualifier text, notes text
);
create table public.eval_results (
  id bigserial primary key, run_id bigint references public.agent_runs(id), test_id text, metric text,
  value numeric, threshold numeric, passed boolean, created_at timestamptz not null default now()
);
create table public.lookup_log (
  id bigserial primary key, email text, query text, cost_usd numeric not null default 0,
  created_at timestamptz not null default now()
);
create table public.lookup_queue (
  id bigserial primary key, email text, query text, status text not null default 'queued',
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['agent_runs','relationships','evidence','verification_results','holdings','insider_trades','gold_edges','eval_results','lookup_log','lookup_queue']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Reviewers see only promoted or live links and their evidence; the admin sees everything.
create policy relationships_read on public.relationships for select to authenticated
  using (public.is_admin() or (public.is_allowed() and status in ('promoted','live')));
create policy evidence_read on public.evidence for select to authenticated
  using (public.is_admin() or (public.is_allowed() and exists (
    select 1 from public.relationships r where r.id = relationship_id and r.status in ('promoted','live'))));
create policy holdings_read on public.holdings for select to authenticated using (public.is_allowed());
create policy insider_trades_read on public.insider_trades for select to authenticated using (public.is_allowed());
create policy agent_runs_admin on public.agent_runs for select to authenticated using (public.is_admin());
create policy verification_admin on public.verification_results for select to authenticated using (public.is_admin());
create policy gold_edges_admin on public.gold_edges for select to authenticated using (public.is_admin());
create policy eval_results_admin on public.eval_results for select to authenticated using (public.is_admin());
create policy lookup_log_admin on public.lookup_log for select to authenticated using (public.is_admin());
create policy lookup_queue_admin on public.lookup_queue for select to authenticated using (public.is_admin());
