-- M8 (J9, PRC-1, PRC-2, APP-18): read-only views of test results, agent runs and data mix for the "Under the hood" page.
-- eval_results and agent_runs stay admin-only tables. These functions let any allowlisted account see results,
-- and return cost only to the admin (a reviewer gets null).
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

revoke execute on function public.hood_tests(), public.hood_agents(), public.hood_source_share() from public, anon;
grant execute on function public.hood_tests(), public.hood_agents(), public.hood_source_share() to authenticated;
