-- Proposal for the admin (TRM-4, Nov 5, 2026). NOT applied: companies is a promoted table.
-- Lime's listed company is Neutron Holdings, Inc. (NASDAQ: LIME). 8 of its 11 headlines in the week to Nov 5 name it
-- "Neutron Holdings" and never "Lime", so the news relevance rule files them under Market news. With this alias they count
-- as Lime news (the rule also tries "Neutron"). Check the legal name on the company's own filings before running.
update public.companies
   set aliases = array_append(coalesce(aliases, '{}'), 'Neutron Holdings')
 where ticker = 'LIME' and is_seed and not ('Neutron Holdings' = any(coalesce(aliases, '{}')));
-- Verify: select ticker, name, aliases from public.companies where ticker = 'LIME';
