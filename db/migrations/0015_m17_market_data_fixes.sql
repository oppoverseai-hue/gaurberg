-- M17 (DEM-1) follow-ups on the market-data tables only (never companies or relationships).
-- 1. company_events: a staged copy may sit beside a promoted row for the same date. Each run then stages every date it lists,
--    so promotion can tell "still listed" from "no longer listed" without the loader ever writing a promoted row.
-- 2. company_metrics: operating margin (TTM) for the metrics strip, which shows it instead of gross margin (admin, 2026-10-24).
--    gross_margin stays stored.
alter table public.company_events drop constraint if exists company_events_company_id_event_date_event_type_source_key;
create unique index if not exists company_events_staged_uq on public.company_events(company_id, event_date, event_type, source) where status = 'staged';
create unique index if not exists company_events_promoted_uq on public.company_events(company_id, event_date, event_type, source) where status = 'promoted';

alter table public.company_metrics add column if not exists operating_margin numeric;  -- percent, TTM
