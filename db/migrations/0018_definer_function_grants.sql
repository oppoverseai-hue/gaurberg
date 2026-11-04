-- SECURITY DEFINER functions (item 13; Supabase advisor lint 0029, "Signed-In Users Can Execute SECURITY DEFINER Function"). Written Nov 5, 2026.
-- Not applied until the admin approves. No table, row or policy is changed. Apply as one transaction (apply_migration or the SQL
-- editor do): between steps 2 and 3 the hood_* bodies still name public.*. Rollback: 0018_definer_function_grants.rollback.sql.
-- Tested on a local copy of these functions and policies (db/checks/0018-local/run.sh): reads are unchanged for every role,
-- all five keep search_path = '' and their grants, and the rollback restores the state before 0018.
--
-- Callers (checked Nov 5 in the live database and the repo):
--   is_admin(), is_allowed(): 26 RLS policies on 20 tables (all for the authenticated role), and the three hood_* functions below.
--     Not called by app code. Postgres checks EXECUTE on a function in a policy as the signed-in user, so authenticated must keep it:
--     revoking it would make every allowed read fail.
--   hood_tests(), hood_agents(), hood_source_share(): app/src/app/hood/page.tsx (supabase.rpc, as the signed-in user). Nothing else.
-- anon and PUBLIC already had no EXECUTE on any of the five; step 1 states it so a database rebuilt from these files matches.

-- 1. Signed-out callers: no EXECUTE on any of the five.
revoke execute on function public.is_admin(), public.is_allowed(), public.hood_tests(), public.hood_agents(), public.hood_source_share() from public, anon;

-- 2. is_admin and is_allowed leave the API schema, so /rest/v1/rpc/is_admin and /rest/v1/rpc/is_allowed stop existing.
--    The policies keep working unchanged: a policy stores the function by id, not by name. authenticated keeps EXECUTE (see above).
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role; -- for anything that names private.is_allowed()/is_admin() (stored
                                                              -- policies call them by id and do not need it; tested)
alter function public.is_admin() set schema private;
alter function public.is_allowed() set schema private;

-- 3. The hood_* functions name is_admin/is_allowed in their SQL text, so they are re-pointed at private. They stay in public with
--    EXECUTE for authenticated on purpose: the Under the hood page calls them for every invited user, they return nothing unless
--    is_allowed(), and cost only to the admin. CREATE OR REPLACE keeps their owner and grants.
create or replace function public.hood_tests()
returns table(test_id text, run_id bigint, metric text, value numeric, threshold numeric, passed boolean, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select e.test_id, e.run_id, e.metric, e.value, e.threshold, e.passed, e.created_at
  from public.eval_results e where private.is_allowed();
$$;

create or replace function public.hood_agents()
returns table(agent_name text, mode text, runs bigint, last_run timestamptz, last_model text, cost_usd numeric)
language sql stable security definer set search_path = '' as $$
  select a.agent_name, a.mode, count(*), max(a.started_at),
    (array_agg(a.model order by a.started_at desc))[1],
    case when private.is_admin() then sum(a.cost_usd) end
  from public.agent_runs a where private.is_allowed() group by a.agent_name, a.mode;
$$;

create or replace function public.hood_source_share()
returns table(ticker text, name text, real_links bigint, sample_links bigint)
language sql stable security definer set search_path = '' as $$
  select c.ticker, c.name,
    count(r.id) filter (where coalesce(r.trust_status,'') <> 'sample' and r.source_type <> 'dummy'),
    count(r.id) filter (where r.trust_status = 'sample' or r.source_type = 'dummy')
  from public.companies c
  join public.relationships r on (r.source_id = c.id or r.target_id = c.id) and r.status in ('promoted','live')
  where c.is_seed and private.is_allowed()
  group by c.ticker, c.name;
$$;

-- From here on, new policies and functions call private.is_admin() and private.is_allowed().
