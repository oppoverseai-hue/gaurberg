-- Viewed by me: remembers which companies a user has opened (company page or map), so the Screener can show "Viewed by me".
-- One row per user and company; opening it again updates last_viewed_at and views. Visible to its owner only.
create table if not exists public.viewed_companies (
  id bigserial primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  company_id bigint not null references public.companies(id) on delete cascade,
  views integer not null default 1,
  last_viewed_at timestamptz not null default now(),
  unique (user_id, company_id)
);
alter table public.viewed_companies enable row level security;
create policy viewed_companies_own_select on public.viewed_companies for select to authenticated using (user_id = auth.uid() and public.is_allowed());
create policy viewed_companies_own_insert on public.viewed_companies for insert to authenticated with check (user_id = auth.uid() and public.is_allowed());
create policy viewed_companies_own_update on public.viewed_companies for update to authenticated using (user_id = auth.uid() and public.is_allowed()) with check (user_id = auth.uid());
create policy viewed_companies_own_delete on public.viewed_companies for delete to authenticated using (user_id = auth.uid());
