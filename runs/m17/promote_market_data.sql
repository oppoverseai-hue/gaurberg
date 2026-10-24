-- M17 (DEM-1): promote staged market data (company_metrics, company_events). Prepared by Claude 2026-10-24; NOT run by Claude.
-- Admin approval date: set approved_on below before running. The block refuses to run while it is null.
-- Intended use: once, after the final full US run (planned Tuesday). Run as a whole in the Supabase SQL editor; atomic.
--
-- Scope (run-scoped, staged-only): for each company, the LATEST market_data run that finished and is not 'failed'.
--   company_metrics: that run's staged rows -> promoted.
--   company_events:  that run's staged rows -> promoted (a staged copy of a date that is already promoted is dropped). Then, for the same company and event type, any PROMOTED event dated
--                    today or later that this run no longer lists is set to rejected (the date moved or was dropped).
--                    Skipped for a company whose latest run reports a failed calendar call (status names calendar/earnings),
--                    so a failed call is never read as "no upcoming events".
--   agent_runs:      those runs, failed market_data runs (no rows to review), and pilot runs 65, 66, 68 (their six rows were
--                    promoted earlier by the admin's own SQL) -> review_status 'reviewed', reviewer = admin.
-- AUR lists two earnings dates (2026-10-28 "Q3 2027" and 2026-11-04 "Q3 2026"); both stay staged until the admin checks
-- ir.aurora.tech. To reject one, uncomment the line marked AUR inside the block and set the wrong date.
-- Never touches companies or relationships. Staged rows from earlier runs are left staged (not shown to reviewers).
-- Prints before/after counts per company.

create temp table if not exists _pm(phase text, ticker text, run_id bigint, m_staged int, m_promoted int, m_rejected int, e_staged int, e_promoted int, e_rejected int);
truncate _pm;

do $do$
declare
  approved_on constant date := null;  -- <-- set to the admin approval date, e.g. '2026-10-27'
  admin constant text := 'abhishek.g16@fms.edu';
  r record; listed date[];
begin
  if approved_on is null then raise exception 'set approved_on to the admin approval date before running'; end if;

  -- AUR: reject the wrong earnings date before promoting (admin to fill in after checking ir.aurora.tech).
  -- update public.company_events set status = 'rejected' where company_id = (select id from public.companies where ticker = 'AUR') and event_date = 'YYYY-MM-DD' and status = 'staged';

  create temp table _latest on commit drop as
    select distinct on (c.id) c.id as company_id, c.ticker, a.id as run_id, a.status
    from public.agent_runs a
    join public.companies c on a.target like c.ticker || ' Finnhub %' or a.target like c.ticker || '.%Finnhub %'
    where a.agent_name = 'market_data' and a.finished_at is not null and a.status not like 'failed%'
    order by c.id, a.finished_at desc;

  insert into _pm select 'before', l.ticker, l.run_id,
    (select count(*) from public.company_metrics m where m.company_id = l.company_id and m.status = 'staged'),
    (select count(*) from public.company_metrics m where m.company_id = l.company_id and m.status = 'promoted'),
    (select count(*) from public.company_metrics m where m.company_id = l.company_id and m.status = 'rejected'),
    (select count(*) from public.company_events e where e.company_id = l.company_id and e.status = 'staged'),
    (select count(*) from public.company_events e where e.company_id = l.company_id and e.status = 'promoted'),
    (select count(*) from public.company_events e where e.company_id = l.company_id and e.status = 'rejected')
  from _latest l;

  for r in select * from _latest loop
    update public.company_metrics set status = 'promoted' where company_id = r.company_id and run_id = r.run_id and status = 'staged';
    -- The run stages every date it lists, even one that is already promoted (a staged copy). Read the list first.
    listed := array(select event_date from public.company_events where company_id = r.company_id and run_id = r.run_id and event_type = 'earnings' and status = 'staged');
    -- A staged copy of an already-promoted date is redundant: drop the copy, keep the promoted row.
    delete from public.company_events s where s.company_id = r.company_id and s.run_id = r.run_id and s.status = 'staged'
      and exists (select 1 from public.company_events p where p.company_id = s.company_id and p.event_date = s.event_date
                  and p.event_type = s.event_type and p.source = s.source and p.status = 'promoted');
    update public.company_events set status = 'promoted' where company_id = r.company_id and run_id = r.run_id and status = 'staged';
    if r.status not like '%calendar/earnings%' then
      update public.company_events set status = 'rejected'
        where company_id = r.company_id and event_type = 'earnings' and status = 'promoted'
          and event_date >= current_date and not (event_date = any(listed));
    end if;
  end loop;

  update public.agent_runs set review_status = 'reviewed', reviewer = admin
  where agent_name = 'market_data' and review_status = 'unreviewed'
    and (id in (select run_id from _latest) or status like 'failed%' or id in (65, 66, 68));

  insert into _pm select 'after', l.ticker, l.run_id,
    (select count(*) from public.company_metrics m where m.company_id = l.company_id and m.status = 'staged'),
    (select count(*) from public.company_metrics m where m.company_id = l.company_id and m.status = 'promoted'),
    (select count(*) from public.company_metrics m where m.company_id = l.company_id and m.status = 'rejected'),
    (select count(*) from public.company_events e where e.company_id = l.company_id and e.status = 'staged'),
    (select count(*) from public.company_events e where e.company_id = l.company_id and e.status = 'promoted'),
    (select count(*) from public.company_events e where e.company_id = l.company_id and e.status = 'rejected')
  from _latest l;
end $do$;

select b.ticker, b.run_id,
  b.m_staged || ' -> ' || a.m_staged as metrics_staged, b.m_promoted || ' -> ' || a.m_promoted as metrics_promoted, b.m_rejected || ' -> ' || a.m_rejected as metrics_rejected,
  b.e_staged || ' -> ' || a.e_staged as events_staged, b.e_promoted || ' -> ' || a.e_promoted as events_promoted, b.e_rejected || ' -> ' || a.e_rejected as events_rejected
from _pm b join _pm a on a.ticker = b.ticker and a.phase = 'after' where b.phase = 'before' order by b.ticker;
