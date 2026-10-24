-- Backfill agent_runs review status for runs 48-64 (admin decision 2026-10-24; prepared by Claude, NOT run by Claude).
-- Run once in the Supabase SQL editor. Marks a run reviewed only if it is still 'unreviewed' AND none of its rows are
-- still staged (relationships or company_geo_revenue). On 2026-10-24 all 16 runs qualified (there is no run 54).
-- Re-running is harmless: rows already 'reviewed' are left alone. Prints each run before and after.

create temp table if not exists _rb(phase text, id bigint, agent_name text, review_status text, reviewer text, staged_rows bigint);
truncate _rb;

do $do$
begin
  insert into _rb select 'before', a.id, a.agent_name, a.review_status, a.reviewer,
    (select count(*) from public.relationships r where r.run_id = a.id and r.status = 'staged')
    + (select count(*) from public.company_geo_revenue g where g.run_id = a.id and g.status = 'staged')
  from public.agent_runs a where a.id between 48 and 64;

  update public.agent_runs a set review_status = 'reviewed', reviewer = 'abhishek.g16@fms.edu'
  where a.id between 48 and 64 and a.review_status = 'unreviewed'
    and not exists (select 1 from public.relationships r where r.run_id = a.id and r.status = 'staged')
    and not exists (select 1 from public.company_geo_revenue g where g.run_id = a.id and g.status = 'staged');

  insert into _rb select 'after', a.id, a.agent_name, a.review_status, a.reviewer, null
  from public.agent_runs a where a.id between 48 and 64;
end $do$;

select b.id, b.agent_name, b.staged_rows, b.review_status as before, a.review_status as after, a.reviewer,
  case when b.staged_rows > 0 then 'skipped: has staged rows' when b.review_status = a.review_status then 'unchanged' else 'marked reviewed' end as outcome
from _rb b join _rb a on a.id = b.id and a.phase = 'after' where b.phase = 'before' order by b.id;
