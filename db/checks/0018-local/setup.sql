-- A copy of the live setup for the five functions (Nov 5, 2026): Supabase roles, auth.jwt(), the tables they read, the same
-- function definitions and grants, and policies of each kind that use them. Test data only.
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create schema auth;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

create table public.allowlist (email text primary key, role text not null, created_at timestamptz default now());
insert into public.allowlist values ('admin@test.invalid', 'admin'), ('reviewer@test.invalid', 'reviewer');
create table public.companies (id int primary key, ticker text, name text, is_seed boolean);
insert into public.companies values (1, 'UBER', 'Uber', true), (2, 'LYFT', 'Lyft', true), (3, null, 'Bolt', false);
create table public.relationships (id int primary key, source_id int, target_id int, status text, trust_status text, source_type text);
insert into public.relationships values (1, 1, 2, 'promoted', 'curated', 'sec_filing'), (2, 1, 3, 'live', 'live_generated', 'live'), (3, 2, 3, 'staged', null, 'sec_filing'), (4, 2, 1, 'rejected', null, 'sec_filing');
create table public.eval_results (test_id text, run_id bigint, metric text, value numeric, threshold numeric, passed boolean, created_at timestamptz default now());
insert into public.eval_results values ('EXT-1', 1, 'precision', 0.9, 0.9, true);
create table public.agent_runs (agent_name text, mode text, started_at timestamptz default now(), model text, cost_usd numeric);
insert into public.agent_runs values ('filings_extraction', 'batch', now(), 'm', 0.12);
grant select on all tables in schema public to anon, authenticated, service_role;
alter table public.allowlist enable row level security; alter table public.companies enable row level security;
alter table public.relationships enable row level security; alter table public.eval_results enable row level security;
alter table public.agent_runs enable row level security;

-- The five functions exactly as pg_get_functiondef printed them on Nov 5.
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
  select exists (select 1 from public.allowlist a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email','')) and a.role = 'admin');
$function$;
CREATE OR REPLACE FUNCTION public.is_allowed() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
  select exists (
    select 1 from public.allowlist a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$function$;
CREATE OR REPLACE FUNCTION public.hood_tests() RETURNS TABLE(test_id text, run_id bigint, metric text, value numeric, threshold numeric, passed boolean, created_at timestamp with time zone) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
  select e.test_id, e.run_id, e.metric, e.value, e.threshold, e.passed, e.created_at
  from public.eval_results e where public.is_allowed();
$function$;
CREATE OR REPLACE FUNCTION public.hood_agents() RETURNS TABLE(agent_name text, mode text, runs bigint, last_run timestamp with time zone, last_model text, cost_usd numeric) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
  select a.agent_name, a.mode, count(*), max(a.started_at),
    (array_agg(a.model order by a.started_at desc))[1],
    case when public.is_admin() then sum(a.cost_usd) end
  from public.agent_runs a where public.is_allowed() group by a.agent_name, a.mode;
$function$;
CREATE OR REPLACE FUNCTION public.hood_source_share() RETURNS TABLE(ticker text, name text, real_links bigint, sample_links bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
  select c.ticker, c.name,
    count(r.id) filter (where coalesce(r.trust_status,'') <> 'sample' and r.source_type <> 'dummy'),
    count(r.id) filter (where r.trust_status = 'sample' or r.source_type = 'dummy')
  from public.companies c
  join public.relationships r on (r.source_id = c.id or r.target_id = c.id) and r.status in ('promoted','live')
  where c.is_seed and public.is_allowed()
  group by c.ticker, c.name;
$function$;
-- Live ACL: {postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres}
revoke all on function public.is_admin(), public.is_allowed(), public.hood_tests(), public.hood_agents(), public.hood_source_share() from public;
grant execute on function public.is_admin(), public.is_allowed(), public.hood_tests(), public.hood_agents(), public.hood_source_share() to authenticated, service_role;

-- Policies of each kind seen live (definitions as pg_policies printed them).
create policy companies_read on public.companies for select to authenticated using (public.is_allowed());
create policy relationships_read on public.relationships for select to authenticated using (public.is_admin() or (public.is_allowed() and status = any (array['promoted','live'])));
create policy eval_results_admin on public.eval_results for select to authenticated using (public.is_admin());
create policy agent_runs_admin on public.agent_runs for select to authenticated using (public.is_admin());
create policy allowlist_admin_all on public.allowlist for all to authenticated using (public.is_admin()) with check (public.is_admin());
