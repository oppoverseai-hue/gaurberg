-- Previous screens: each screener run with at least one filter is remembered per user, so past screens can be re-run from the Screener tab.
-- Only the filters are stored (segment, size, market, direction), never results. A repeat of the same filters updates used_at instead of adding a row.
create table if not exists public.saved_screens (
  id bigserial primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  filters jsonb not null,
  filters_key text not null,
  used_at timestamptz not null default now(),
  unique (user_id, filters_key)
);
alter table public.saved_screens enable row level security;
create policy saved_screens_own_select on public.saved_screens for select to authenticated using (user_id = auth.uid() and public.is_allowed());
create policy saved_screens_own_insert on public.saved_screens for insert to authenticated with check (user_id = auth.uid() and public.is_allowed());
create policy saved_screens_own_update on public.saved_screens for update to authenticated using (user_id = auth.uid() and public.is_allowed()) with check (user_id = auth.uid());
create policy saved_screens_own_delete on public.saved_screens for delete to authenticated using (user_id = auth.uid());
