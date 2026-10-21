-- M7 live lookup (J5: LIV-1 to LIV-4, NFR-5, NFR-6). Progress, queue and per-person daily limit.
alter table public.lookup_queue
  add column if not exists ticker text,
  add column if not exists company_id bigint references public.companies(id),
  add column if not exists step text,
  add column if not exists error text,
  add column if not exists run_id bigint references public.agent_runs(id),
  add column if not exists links_found int,
  add column if not exists finished_at timestamptz;
alter table public.lookup_queue drop constraint if exists lookup_queue_status_check;
alter table public.lookup_queue add constraint lookup_queue_status_check check (status in ('queued','running','done','failed'));
alter table public.lookup_log
  add column if not exists queue_id bigint references public.lookup_queue(id),
  add column if not exists outcome text;
create index if not exists lookup_log_email_day on public.lookup_log (lower(email), created_at);
-- A person sees only their own lookups; the admin sees all (existing admin policies stay).
drop policy if exists lookup_queue_own on public.lookup_queue;
create policy lookup_queue_own on public.lookup_queue for select to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email','')));
