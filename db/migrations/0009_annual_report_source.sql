-- M14: allow a link to cite a non-SEC annual report (London and Hong Kong company reports).
-- SEC filings, including 20-F filings, keep source_type 'sec_filing'.
alter table public.relationships drop constraint if exists relationships_source_type_check;
alter table public.relationships
  add constraint relationships_source_type_check
  check (source_type = any (array['sec_filing','annual_report','press_release','news','manual','dummy']::text[]));
