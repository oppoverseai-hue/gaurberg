do $do$
declare run_id bigint; rid bigint; a bigint; b bigint; r record; k int;
begin
insert into public.companies(name,entity_type) select v.n,v.t from (values ($q$DENSO$q$,$q$public_company$q$),($q$EDB$q$,$q$institution$q$),($q$GUC$q$,$q$public_company$q$),($q$OmniVision Technologies$q$,$q$public_company$q$),($q$Philips$q$,$q$public_company$q$),($q$SSMC$q$,$q$private_company$q$),($q$Sony$q$,$q$public_company$q$),($q$Toyota$q$,$q$public_company$q$),($q$VIS$q$,$q$public_company$q$),($q$Xintec$q$,$q$public_company$q$)) v(n,t) where not exists (select 1 from public.companies c where lower(c.name)=lower(v.n));
create temp table _q(i int primary key, t text) on commit drop;
insert into _q values (1,$q$As of 
February 28, 2026
, we 
owned approximately 41.0% of the equity interest in Xintec.$q$),(2,$q$As of 
February 28, 2026
, we owned approximately 34.8% of the equity interest in GUC.$q$),(3,$q$As of February 28, 
2026
, we owned approximately 27.6
% of the equity interest in VIS.$q$),(4,$q$In 
2025
, we had total sales of NT
$31,094
 million (US
$991
 million) to GUC, representing 
0.8%
 of our total revenue.$q$),(5,$q$In February 2024, we, Sony, DENSO and Toyota Motor Corporation (“Toyota”) announced further investment into JASM to build and operate a second semiconductor manufacturing facility.$q$),(6,$q$In January 2007, we acquired a 51.2% equity interest in Xintec, a supplier of wafer level packaging service, to 
support our CMOS image sensor manufacturing business.$q$),(7,$q$In January 2007, we acquired a 51.2% equity interest in Xintec, a supplier of wafer level packaging service, to support our CMOS image sensor manufacturing business.$q$),(8,$q$In October 2003, we and OmniVision Technologies Inc. (“OVT”), entered into an agreement to form VisEra Technologies, a joint venture in Taiwan, for the purpose of providing back-end service for CMOS image sensor manufacturing business.$q$),(9,$q$Pursuant to the terms of a manufacturing agreement between both parties, VIS was obligated to use its best 
commercial efforts to manufacture wafers at specified yield rates for us up to a fixed amount of reserved capacity per 
month, and TSMC was required to use its best commercial efforts to maintain utilization of such reserved capacity.$q$),(10,$q$SSMC is a joint venture in Singapore that we established with Philips and EDB to produce integrated circuits by 
means of advanced submicron manufacturing processes.$q$),(11,$q$SSMC’s business is exclusively dedicated to the manufacturing of wafers 
for us, our subsidiaries, NXP and its subsidiaries.$q$),(12,$q$Under a Shareholders Agreement entered into with Philips and EDB Investments Pte Ltd. on March
30, 1999, the parties formed a joint venture company, SSMC, which is an integrated circuit foundry
in Singapore.$q$),(13,$q$our current ownership in SSMC is 
38.8%, with NXP holding the remaining 61.2%.$q$);
create temp table _e(n int, ty text, s text, g text, qs int[], sec text[], pct numeric, qual text, basis text, note text) on commit drop;
insert into _e values (1,$q$invests$q$,$q$TSM$q$,$q$SSMC$q$,$q${13}$q$::int[],$q${mdna}$q$::text[],38.8,$q$approximate$q$,$q$source_revenue$q$,null),(2,$q$partners$q$,$q$TSM$q$,$q$OmniVision Technologies$q$,$q${8}$q$::int[],$q${notes}$q$::text[],null,null,null,null),(3,$q$invests$q$,$q$TSM$q$,$q$Xintec$q$,$q${1}$q$::int[],$q${mdna}$q$::text[],41.0,$q$approximate$q$,$q$source_revenue$q$,null),(4,$q$supplies$q$,$q$Xintec$q$,$q$TSM$q$,$q${7,6}$q$::int[],$q${mdna,mdna}$q$::text[],null,null,null,null),(5,$q$partners$q$,$q$TSM$q$,$q$Sony$q$,$q${5}$q$::int[],$q${notes}$q$::text[],null,null,null,null),(6,$q$partners$q$,$q$TSM$q$,$q$DENSO$q$,$q${5}$q$::int[],$q${notes}$q$::text[],null,null,null,null),(7,$q$partners$q$,$q$TSM$q$,$q$Toyota$q$,$q${5}$q$::int[],$q${notes}$q$::text[],null,null,null,null),(8,$q$invests$q$,$q$TSM$q$,$q$VIS$q$,$q${3}$q$::int[],$q${mdna}$q$::text[],27.6,$q$approximate$q$,$q$source_revenue$q$,null),(9,$q$supplies$q$,$q$VIS$q$,$q$TSM$q$,$q${9}$q$::int[],$q${mdna}$q$::text[],null,null,null,null),(10,$q$partners$q$,$q$TSM$q$,$q$SSMC$q$,$q${10,12}$q$::int[],$q${mdna,notes}$q$::text[],null,null,null,null),(11,$q$supplies$q$,$q$SSMC$q$,$q$TSM$q$,$q${11}$q$::int[],$q${mdna}$q$::text[],null,null,null,null),(12,$q$partners$q$,$q$TSM$q$,$q$Philips$q$,$q${10}$q$::int[],$q${mdna}$q$::text[],null,null,null,null),(13,$q$partners$q$,$q$TSM$q$,$q$EDB$q$,$q${10}$q$::int[],$q${mdna}$q$::text[],null,null,null,null),(14,$q$invests$q$,$q$TSM$q$,$q$GUC$q$,$q${2}$q$::int[],$q${mdna}$q$::text[],34.8,$q$approximate$q$,$q$source_revenue$q$,null),(15,$q$sells_to$q$,$q$TSM$q$,$q$GUC$q$,$q${4}$q$::int[],$q${mdna}$q$::text[],0.8,$q$exact$q$,$q$source_revenue$q$,null);
create or replace function pg_temp.nid(l text) returns bigint language sql as $f$ select id from public.companies where case l  when $q$TSM$q$ then ticker=$q$TSM$q$ else lower(name)=lower(l) end order by id limit 1 $f$;
insert into public.agent_runs(agent_name,mode,target,model,tokens_in,tokens_out,cost_usd,status,review_status) values ('filings_extraction','batch',$q$TSM M6 group 2-4$q$,'claude-sonnet-5-5',319270,6873,1.0245,'completed','unreviewed') returning id into run_id;
for r in select * from _e order by n loop a := pg_temp.nid(r.s); b := pg_temp.nid(r.g); if r.ty in ('competes','partners') and a > b then rid := a; a := b; b := rid; end if; rid := null; select id into rid from public.relationships where source_id=a and target_id=b and relationship_type=r.ty order by id limit 1; if rid is null then insert into public.relationships(source_id,target_id,relationship_type,exposure_pct,exposure_qualifier,exposure_basis,exposure_as_of,source_type,status,run_id,as_of_date,note) values (a,b,r.ty,r.pct,r.qual,case when r.pct is null then 'none' else r.basis end,case when r.pct is null then null else '2025-12-31'::date end,'sec_filing','staged',run_id,'2025-12-31',r.note) returning id into rid; end if; if (select status from public.relationships where id=rid)='staged' then for k in 1..array_length(r.qs,1) loop insert into public.evidence(relationship_id,document_url,section,quote,quote_found,published_at) select rid,$q$https://www.sec.gov/Archives/edgar/data/1046179/000162828026025362/tsm-20251231.htm$q$,r.sec[k],t,true,$q$2026-04-16$q$ from _q where i=r.qs[k]; end loop; end if; end loop;
end $do$;
