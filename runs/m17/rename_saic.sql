-- Rename company 465 "SAIC" to "SAIC Motor" and keep "SAIC" as an alias (admin decision 2026-10-24). Prepared by Claude; NOT run by Claude.
-- Run once in the Supabase SQL editor. Guarded: does nothing unless 465 is still named "SAIC". Prints the row after.
-- Note: the live lookup reads companies.aliases, so a filing that says "SAIC" will now resolve to SAIC Motor and show as "SAIC Motor (SAIC)" on the map.
update public.companies
set name = 'SAIC Motor', aliases = case when 'SAIC' = any(aliases) then aliases else array_append(aliases, 'SAIC') end
where id = 465 and name = 'SAIC';
select id, ticker, name, aliases, (select count(*) from public.relationships r where (r.source_id = 465 or r.target_id = 465) and r.status = 'promoted') as promoted_edges
from public.companies where id = 465;
