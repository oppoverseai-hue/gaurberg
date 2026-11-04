-- Read-only role check (item 13). Run each block on its own (one implicit transaction each): it sets the sign-in claims, switches
-- role for that transaction only and selects counts. Nothing is written. Emails come from the allowlist and are never printed.
-- After 0018, replace public.is_allowed()/public.is_admin() below with private.is_allowed()/private.is_admin().
--
-- Expected (Nov 5, 2026, before 0018):
--   admin:     companies 477, links promoted 610 / live 34 / staged 0 / rejected 61, evidence 1013, eval_results 124, agent_runs 124,
--              hood_tests 124, cost rows 8, is_allowed true, is_admin true
--   reviewer:  companies 477, links 610 / 34 / 0 / 0, evidence 945, eval_results 0, agent_runs 0, hood_tests 124, cost rows 0,
--              is_allowed true, is_admin false
--   signed in, not invited: every count 0, is_allowed false, is_admin false
--   signed out (anon): every count 0, no EXECUTE on any of the five functions

-- Admin
select set_config('request.jwt.claims', json_build_object('role','authenticated','email',(select email from public.allowlist where role='admin' limit 1))::text, true);
set local role authenticated;
select 'admin' as who,
 (select count(*) from public.companies) companies,
 (select count(*) from public.relationships where status='promoted') rel_promoted,
 (select count(*) from public.relationships where status='live') rel_live,
 (select count(*) from public.relationships where status='staged') rel_staged,
 (select count(*) from public.relationships where status='rejected') rel_rejected,
 (select count(*) from public.evidence) evidence,
 (select count(*) from public.eval_results) eval_results,
 (select count(*) from public.agent_runs) agent_runs,
 (select count(*) from public.hood_tests()) hood_tests,
 (select count(*) filter (where cost_usd is not null) from public.hood_agents()) hood_cost_rows,
 public.is_allowed() is_allowed, public.is_admin() is_admin;

-- Invited reviewer: the same block with (select email from public.allowlist where role='reviewer' order by created_at limit 1) and who = 'reviewer'.

-- Signed in, not invited: the same block with 'email','not-invited@example.invalid' and who = 'not invited'.

-- Signed out
select set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
set local role anon;
select 'signed out' as who,
 (select count(*) from public.companies) companies,
 (select count(*) from public.relationships) relationships,
 (select count(*) from public.evidence) evidence,
 (select count(*) from public.eval_results) eval_results,
 has_function_privilege('public.hood_tests()', 'execute') can_hood_tests,
 has_function_privilege('public.hood_agents()', 'execute') can_hood_agents,
 has_function_privilege('public.hood_source_share()', 'execute') can_hood_share;
