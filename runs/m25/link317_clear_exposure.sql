-- GRF-11, GRF-17: link 317 (Applied Digital invests in Corintis) stores exposure_pct 4 (ownership, approximate), but its only saved quote
-- ("... an investment by the Company in Corintis SA ... in exchange for Series A1 preferred shares.") states no figure.
-- For the admin to run in the Supabase SQL editor. Not run by Claude Code. Touches this one promoted row only.
-- Run it ONLY if a search of the Applied Digital 10-K (apld-20260531.htm) finds no sentence stating the 4%.
-- The 10-K text is not saved in the repo, so that search has not been done yet.
-- GRF-11: with no stated figure the size fields stay empty and the kind of share is 'none' (a kind of share with no percentage is not allowed).
update relationships
   set exposure_pct = null, exposure_basis = 'none', exposure_qualifier = null, exposure_as_of = null,
       note = concat_ws('; ', nullif(note, ''), 'Admin 2026-10-25: exposure cleared, 4% not stated in the saved quote or found in the 10-K')
 where id = 317 and exposure_pct = 4 and exposure_basis = 'ownership';
-- Expect: UPDATE 1. Check afterwards:
-- select id, exposure_pct, exposure_basis, exposure_qualifier, exposure_as_of, note from relationships where id = 317;
