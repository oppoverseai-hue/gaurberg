-- Rollback for 0018_definer_function_grants.sql. Run only if 0018 was applied and something broke.
-- Puts the database back exactly as it was on Nov 5, 2026 before 0018: is_admin() and is_allowed() in public, the hood_* functions
-- calling public.*, the private schema gone. Grants: EXECUTE stays with postgres, authenticated and service_role (an ALTER ... SET
-- SCHEMA keeps a function's grants); anon and PUBLIC had none before 0018 and get none here. Policies follow the move back by
-- function id, as they followed it out. No table, row or policy is changed.
-- One transaction: between steps 1 and 2 the hood_* bodies name private.*, so nothing may run in between, and a failure leaves 0018 in place.

begin;

-- 1. is_admin() and is_allowed() back to public. Grants and search_path ('') travel with them.
alter function private.is_admin() set schema public;
alter function private.is_allowed() set schema public;

-- 2. The hood_* functions call public.* again. This must come after step 1: Postgres checks a SQL function's body when it is
--    created, so public.is_allowed() has to exist first.
--    CREATE OR REPLACE keeps their owner and grants. Bodies are the ones in place before 0018 (0006_m8_under_the_hood.sql).
create or replace function public.hood_tests()
returns table(test_id text, run_id bigint, metric text, value numeric, threshold numeric, passed boolean, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select e.test_id, e.run_id, e.metric, e.value, e.threshold, e.passed, e.created_at
  from public.eval_results e where public.is_allowed();
$$;

create or replace function public.hood_agents()
returns table(agent_name text, mode text, runs bigint, last_run timestamptz, last_model text, cost_usd numeric)
language sql stable security definer set search_path = '' as $$
  select a.agent_name, a.mode, count(*), max(a.started_at),
    (array_agg(a.model order by a.started_at desc))[1],
    case when public.is_admin() then sum(a.cost_usd) end
  from public.agent_runs a where public.is_allowed() group by a.agent_name, a.mode;
$$;

create or replace function public.hood_source_share()
returns table(ticker text, name text, real_links bigint, sample_links bigint)
language sql stable security definer set search_path = '' as $$
  select c.ticker, c.name,
    count(r.id) filter (where coalesce(r.trust_status,'') <> 'sample' and r.source_type <> 'dummy'),
    count(r.id) filter (where r.trust_status = 'sample' or r.source_type = 'dummy')
  from public.companies c
  join public.relationships r on (r.source_id = c.id or r.target_id = c.id) and r.status in ('promoted','live')
  where c.is_seed and public.is_allowed()
  group by c.ticker, c.name;
$$;

-- 3. Grants as before 0018, stated explicitly.
revoke execute on function public.is_admin(), public.is_allowed(), public.hood_tests(), public.hood_agents(), public.hood_source_share() from public, anon;
grant execute on function public.is_admin(), public.is_allowed(), public.hood_tests(), public.hood_agents(), public.hood_source_share() to authenticated, service_role;

-- 4. The private schema held only these two functions. Without CASCADE this fails, and changes nothing, if anything else is in it.
drop schema private;

commit;
