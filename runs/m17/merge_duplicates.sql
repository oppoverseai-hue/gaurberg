-- M17 duplicate-entity merge (prepared 2026-10-24 for admin review; NOT run by Claude).
-- Run once, as a whole, in the Supabase SQL editor. The DO block is atomic: any failed guard rolls back everything.
-- Writes companies and relationships (promoted tables), so it is admin-run only.
--
-- Merges (loser -> survivor). Survivors keep their id, name, ticker and edges.
--   429 "Uber"                     -> 1   UBER "Uber Technologies"   4 promoted edges re-pointed (567, 571, 622, 656)
--   524 "AMD"                      -> 10  AMD  "Advanced Micro Devices" 1 promoted edge re-pointed (689)
--   290 "Neeva Inc."               -> 287 "Neeva"                    1 rejected edge re-pointed (396)
--   490 "Trip"                     -> 494 "Trip.com"                 1 rejected edge re-pointed (681)
--   471 "SAIC Motor"               -> 465 "SAIC"                     1 rejected edge re-pointed (633)
--   447 "Yutong"                   -> 451 "Yutong Bus"               1 rejected edge re-pointed (591; already noted "merged into 599")
--   440 "Yutong entities"          -> 451 "Yutong Bus"               1 rejected edge re-pointed (595)
--   469 "Cyantron"                 -> 468 "Cyantron Logistics Technology Co., Ltd."  no edges
--   104 "Zoox"                     -> 47  AMZN "Amazon"              no edges (parent rule: Zoox shows under Amazon)
--   89  "Uber Freight"             -> 1   UBER                       no edges (parent rule: Uber Freight shows under Uber)
-- Checked before writing: no survivor already has an edge of the same type with the same counterparty, so no promoted
-- edge becomes a duplicate. The block still checks this and, if it ever happens, keeps the survivor's edge, moves the
-- evidence across and rejects the moved copy (the M15 "merged into" convention). Rejected edges stay rejected.
-- Other tables pointing at companies (price_cache, holdings, insider_trades, lookup_queue, company_geo_revenue,
-- viewed_companies, company_metrics, company_events) had 0 rows on the losers on 2026-10-24; the block re-points any that appear.
-- Not merged (different entities or units with their own edges; parent-rule candidates for a separate decision):
--   Uber Freight is merged above only because it has no edges. Kept: Grab PH Holdings (251), Vodafone Idea/Italia/Spain/
--   Shared Operations, Lenovo NEC (518), Lenovo Vehicle Computing (431), Fujitsu units (511, 513), Nissan Mobility (448),
--   Geely Farizon (454), Tencent Video (497) vs Tencent (480), Alibaba Cloud (486) vs Alibaba (507), HD Hyundai (266) vs
--   Hyundai (112), Telekom Romania Mobile (318) vs Telekom Romania (337), TikTok USDS JV (203) vs TikTok (263),
--   Public Investment Fund (362, Saudi) vs Public Investment Corporation (414, South Africa), Aston Martin F1 teams.
-- No duplicates found for Baidu (63 BIDU), Pony.ai (458 PONY) or WeRide (424 WRD).
-- The last statement prints before/after counts per company.

create temp table if not exists _merge_counts(phase text, company_id bigint, name text, promoted int, live int, staged int, rejected int, other_refs int);
truncate _merge_counts;

do $do$
declare
  r record; dup bigint; s bigint; t bigint; ids bigint[]; n_rel bigint; n_ev bigint;
  pairs constant bigint[][] := array[[429,1],[524,10],[290,287],[490,494],[471,465],[447,451],[440,451],[469,468],[104,47],[89,1]];
  names constant text[][] := array[
    ['Uber','Uber Technologies'],['AMD','Advanced Micro Devices'],['Neeva Inc.','Neeva'],['Trip','Trip.com'],['SAIC Motor','SAIC'],
    ['Yutong','Yutong Bus'],['Yutong entities','Yutong Bus'],['Cyantron','Cyantron Logistics Technology Co., Ltd.'],['Zoox','Amazon'],['Uber Freight','Uber Technologies']];
  i int;
begin
  ids := array(select distinct unnest(pairs));
  select count(*) into n_rel from public.relationships;
  select count(*) into n_ev from public.evidence;
  -- Guards: every id still holds the expected company (fails if run twice or if ids changed).
  for i in 1 .. array_length(pairs, 1) loop
    if not exists (select 1 from public.companies where id = pairs[i][1] and name = names[i][1]) then
      raise exception 'loser % is not "%" (already merged?)', pairs[i][1], names[i][1]; end if;
    if not exists (select 1 from public.companies where id = pairs[i][2] and name = names[i][2]) then
      raise exception 'survivor % is not "%"', pairs[i][2], names[i][2]; end if;
  end loop;

  insert into _merge_counts
  select 'before', c.id, c.name,
    (select count(*) from public.relationships x where (x.source_id=c.id or x.target_id=c.id) and x.status='promoted'),
    (select count(*) from public.relationships x where (x.source_id=c.id or x.target_id=c.id) and x.status='live'),
    (select count(*) from public.relationships x where (x.source_id=c.id or x.target_id=c.id) and x.status='staged'),
    (select count(*) from public.relationships x where (x.source_id=c.id or x.target_id=c.id) and x.status='rejected'),
    (select count(*) from public.holdings h where h.company_id=c.id) + (select count(*) from public.insider_trades h where h.company_id=c.id)
      + (select count(*) from public.lookup_queue h where h.company_id=c.id) + (select count(*) from public.company_geo_revenue h where h.company_id=c.id)
      + (select count(*) from public.company_metrics h where h.company_id=c.id) + (select count(*) from public.company_events h where h.company_id=c.id)
  from public.companies c where c.id = any(ids);

  for i in 1 .. array_length(pairs, 1) loop
    -- Re-point every edge on the loser. Partners and competes are stored once with the lower id as source.
    for r in select * from public.relationships where source_id = pairs[i][1] or target_id = pairs[i][1] order by id loop
      s := case when r.source_id = pairs[i][1] then pairs[i][2] else r.source_id end;
      t := case when r.target_id = pairs[i][1] then pairs[i][2] else r.target_id end;
      if s = t then raise exception 'edge % would point a company at itself', r.id; end if;
      if r.relationship_type in ('partners','competes') and s > t then select t, s into s, t; end if;
      update public.relationships set source_id = s, target_id = t,
        note = concat_ws('; ', note, format('Merge 2026-10-24: company %s "%s" merged into %s', pairs[i][1], names[i][1], pairs[i][2]))
        where id = r.id;
      if r.status <> 'rejected' then
        select id into dup from public.relationships
          where source_id = s and target_id = t and relationship_type = r.relationship_type and status <> 'rejected' and id <> r.id order by id limit 1;
        if dup is not null then
          update public.evidence e set relationship_id = dup where e.relationship_id = r.id
            and not exists (select 1 from public.evidence e2 where e2.relationship_id = dup and e2.quote is not distinct from e.quote);
          update public.relationships set status = 'rejected', note = concat_ws('; ', note, format('duplicate of %s after merge (evidence moved)', dup)) where id = r.id;
        end if;
      end if;
    end loop;
    -- Re-point the other tables. viewed_companies and price_cache rows are per-user/per-day conveniences: drop the loser's copy if the survivor has one.
    update public.holdings set company_id = pairs[i][2] where company_id = pairs[i][1];
    update public.insider_trades set company_id = pairs[i][2] where company_id = pairs[i][1];
    update public.lookup_queue set company_id = pairs[i][2] where company_id = pairs[i][1];
    update public.company_geo_revenue set company_id = pairs[i][2] where company_id = pairs[i][1];
    update public.company_metrics set company_id = pairs[i][2] where company_id = pairs[i][1];
    update public.company_events set company_id = pairs[i][2] where company_id = pairs[i][1];
    delete from public.viewed_companies v where v.company_id = pairs[i][1]
      and exists (select 1 from public.viewed_companies w where w.company_id = pairs[i][2] and w.user_id = v.user_id);
    update public.viewed_companies set company_id = pairs[i][2] where company_id = pairs[i][1];
    delete from public.price_cache where company_id = pairs[i][1];
    delete from public.companies where id = pairs[i][1];
  end loop;

  insert into _merge_counts
  select 'after', c.id, c.name,
    (select count(*) from public.relationships x where (x.source_id=c.id or x.target_id=c.id) and x.status='promoted'),
    (select count(*) from public.relationships x where (x.source_id=c.id or x.target_id=c.id) and x.status='live'),
    (select count(*) from public.relationships x where (x.source_id=c.id or x.target_id=c.id) and x.status='staged'),
    (select count(*) from public.relationships x where (x.source_id=c.id or x.target_id=c.id) and x.status='rejected'),
    (select count(*) from public.holdings h where h.company_id=c.id) + (select count(*) from public.insider_trades h where h.company_id=c.id)
      + (select count(*) from public.lookup_queue h where h.company_id=c.id) + (select count(*) from public.company_geo_revenue h where h.company_id=c.id)
      + (select count(*) from public.company_metrics h where h.company_id=c.id) + (select count(*) from public.company_events h where h.company_id=c.id)
  from public.companies c where c.id = any(ids);

  -- Totals must not change: no edge or quote is lost, only moved (or, for a would-be duplicate, rejected).
  if (select count(*) from public.relationships) <> n_rel then raise exception 'relationship count changed'; end if;
  if (select count(*) from public.evidence) <> n_ev then raise exception 'evidence count changed'; end if;
end $do$;

-- Before/after per company (losers have no "after" row: they are deleted).
select b.company_id, b.name,
  b.promoted as promoted_before, a.promoted as promoted_after,
  b.live as live_before, a.live as live_after,
  b.staged as staged_before, a.staged as staged_after,
  b.rejected as rejected_before, a.rejected as rejected_after,
  b.other_refs as other_refs_before, a.other_refs as other_refs_after,
  case when a.company_id is null then 'merged away' else 'kept' end as outcome
from _merge_counts b left join _merge_counts a on a.company_id = b.company_id and a.phase = 'after'
where b.phase = 'before' order by outcome desc, b.company_id;
