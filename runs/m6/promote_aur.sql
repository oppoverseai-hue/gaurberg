-- M6 Aurora: apply the parent rule to two staged links, then promote all 20 as Curated.
-- Admin approved in chat on 2026-10-21 and ran this block in the Supabase SQL editor the same day (100 promoted, 1 staged afterwards). Touches only run 17 rows (ids 82 to 101).
do $do$
declare aur bigint; amz bigint; ub bigint;
begin
select id into aur from public.companies where ticker='AUR';
select id into amz from public.companies where ticker='AMZN';
select id into ub from public.companies where ticker='UBER';
update public.relationships set source_id=least(aur,amz), target_id=greatest(aur,amz), note='Zoox is an Amazon unit; shown under Amazon (parent rule, 2026-10-21)' where id=94 and status='staged';
update public.relationships set source_id=aur, target_id=ub, note='Uber Freight is an Uber unit; shown under Uber (parent rule, 2026-10-21)' where id=90 and status='staged';
update public.relationships set status='promoted', trust_status='curated' where id between 82 and 101 and status='staged' and run_id=17;
end $do$;
