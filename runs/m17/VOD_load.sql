do $do$
declare run_id bigint; cid bigint;
begin
select id into cid from public.companies where ticker=$q$VOD$q$;
if cid is null then raise exception 'company % not found', $q$VOD$q$; end if;
insert into public.agent_runs(agent_name,mode,target,model,tokens_in,tokens_out,cost_usd,started_at,finished_at,status,review_status) values ('market_data','batch',$q$VOD.L Finnhub metric, recommendation trends, earnings calendar (M17)$q$,'none (Finnhub API, no model call)',0,0,0,$q$2026-10-22T16:45:22.218147+00:00$q$::timestamptz,$q$2026-10-22T16:45:26.731825+00:00$q$::timestamptz,$q$failed: profile2 HTTP 403 (not on the free plan); metric HTTP 403 (not on the free plan); recommendation HTTP 403 (not on the free plan); calendar/earnings HTTP 403 (not on the free plan)$q$,'unreviewed') returning id into run_id;
end $do$;
