-- Early-access waitlist (ACC-5, ACC-6). Added Nov 4, 2026.
-- A person signs in with Google; if their email is not on the allowlist they answer three questions and join here.
-- Each person can create and read only their own row (matched on auth.uid() and their Google email). The admin reads all
-- rows and marks invitations. Inviting someone also adds them to the allowlist (done by the admin page, as the admin).

create table if not exists public.waitlist (
  id bigserial primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null unique,
  name text,
  role text check (role in ('independent', 'fund', 'equity_research', 'corporate', 'student', 'other')),
  tools text[] not null default '{}',
  first_company text check (char_length(first_company) <= 120),
  open_to_call boolean not null default false,
  consent_updates boolean not null check (consent_updates),
  source jsonb not null default '{}'::jsonb, -- utm_* tags, referrer and landing path from the visitor's first visit
  country text,                              -- from the hosting provider's IP country header, two letters
  status text not null default 'waiting' check (status in ('waiting', 'invited', 'removed')),
  created_at timestamptz not null default now(),
  confirmation_sent_at timestamptz,
  invited_at timestamptz,
  invite_sent_at timestamptz
);

alter table public.waitlist enable row level security;

create policy waitlist_insert_own on public.waitlist for insert to authenticated
  with check (user_id = auth.uid() and lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) and status = 'waiting');
create policy waitlist_read_own on public.waitlist for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy waitlist_admin_update on public.waitlist for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create index if not exists waitlist_created_idx on public.waitlist (created_at desc);
