-- Applied to Supabase as acquires_link_type (Oct 21, 2026). Adds a sixth link type.
-- Direction: source = acquirer, target = acquired company. Ownership share, when the filing states one,
-- goes in exposure_pct with exposure_basis = 'ownership'.
alter table public.relationships drop constraint relationships_relationship_type_check;
alter table public.relationships add constraint relationships_relationship_type_check
  check (relationship_type in ('supplies','sells_to','partners','competes','invests','acquires'));
comment on column public.relationships.relationship_type is 'supplies, sells_to, partners, competes, invests, acquires. Edge points from provider to receiver; for acquires, source = acquirer, target = acquired company. partners and competes are stored once with the lower id as source.';
