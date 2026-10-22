-- M16 fix: a named bucket the report does not break down (for example "Africa" = southern Africa plus Egypt) is valid with no country and no region.
-- It stays unmapped to a region until a country split exists, so it never counts toward a region by guess.
alter table public.company_geo_revenue drop constraint if exists company_geo_revenue_check;
