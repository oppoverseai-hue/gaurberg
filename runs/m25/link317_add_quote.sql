-- GRF-11, GRF-17: link 317 (Applied Digital invests in Corintis) stores exposure_pct 4 (ownership, approximate), but its only saved
-- quote states no figure, so the Exposure view flags it "stated figure not found in the saved quote".
-- The 10-K (apld-20260531.htm, fiscal year ended May 31, 2026, notes, the page before the page-101 footer) states the 4%. The sentence below
-- was found word for word by agents/filings_extraction/verify_quotes.py (run on a copy, 2026-10-25), spacing as the text
-- extraction gives it ("$ 10.0", "4 %"), like the other stored quotes.
-- For the admin to run in the Supabase SQL editor. Not run by Claude Code. Adds one evidence row to this promoted link.
insert into evidence (relationship_id, section, quote, quote_found, document_url, published_at)
select 317, 'notes',
       'During the quarter ended May 31, 2026, the Company sold $ 5.0 million of Corintis''s shares to a third party, bringing the Company''s investment in Corintis to $ 10.0 million, or approximately 4 % of Corintis’s outstanding equity.',
       true, 'https://www.sec.gov/Archives/edgar/data/1144879/000114487926000048/apld-20260531.htm', '2026-07-29'
 where exists (select 1 from relationships where id = 317 and exposure_pct = 4 and exposure_basis = 'ownership')
   and not exists (select 1 from evidence where relationship_id = 317 and quote like '%approximately 4 % of Corintis%');
-- Expect: INSERT 0 1.

-- Separate decision, not required for the quote: the figure is as of May 31, 2026 (the 10-K's fiscal year end), but the row stores
-- exposure_as_of 2025-12-31. Uncomment to correct it:
-- update relationships set exposure_as_of = '2026-05-31' where id = 317 and exposure_as_of = '2025-12-31';

-- Check afterwards:
-- select r.id, r.exposure_pct, r.exposure_as_of, e.quote from relationships r join evidence e on e.relationship_id = r.id where r.id = 317;
