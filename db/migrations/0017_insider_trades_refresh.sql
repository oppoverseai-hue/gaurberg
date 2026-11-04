-- Insider trades stored by a daily job instead of read from EDGAR on every company page load (NFR-1, SMX-3). Added Nov 4, 2026.
-- Additive only: insider_trades has been empty since 0002. Written by /api/cron/insiders with the service-role key; read by allowed users.

alter table public.insider_trades
  add column if not exists filed date,                                  -- the Form 4's filing date
  add column if not exists line int not null default 0,                 -- the transaction's place in its Form 4
  add column if not exists fetched_at timestamptz not null default now();

-- One row per transaction, so the daily job can upsert and then remove what is no longer in the 90-day window.
create unique index if not exists insider_trades_tx_key on public.insider_trades (company_id, source_url, line);

-- One row per company per check: how many Form 4 filings were read, when, and any error. This is what lets the page say
-- "no open-market trades in the last 90 days (12 filings read)" rather than leave an unexplained gap.
create table if not exists public.insider_checks (
  company_id bigint primary key references public.companies(id) on delete cascade,
  filings_read int not null,
  window_days int not null,
  checked_at timestamptz not null,
  error text
);

alter table public.insider_checks enable row level security;
create policy insider_checks_read on public.insider_checks for select to authenticated using (public.is_allowed());
