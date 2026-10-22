-- M14 Vodafone admin review decisions (2026-10-22). Staged rows only. Atomic: one DO block, nothing is promoted.
-- Run once in the Supabase SQL editor. Re-running would create a second Ziggo Group node and a second VodafoneThree link.
do $do$
declare zid bigint; nid bigint;
begin
  update relationships set status='rejected', note='Admin review 2026-10-22: Drop' where id in (453,439,422,454,459,443,463,460) and status='staged';
  insert into companies(name, entity_type, is_seed, is_hero, aliases, markets) values ('Ziggo Group','private_company',false,false,'{}','{}') returning id into zid;
  update relationships set target_id=zid, exposure_pct=10, exposure_basis='ownership', exposure_qualifier='exact', exposure_as_of='2026-03-31', note='Admin review 2026-10-22: re-pointed from Liberty Global to Ziggo Group; 10% stake per quote' where id=462;
  update relationships set target_id=349, note='Admin review 2026-10-22: re-pointed from CK Hutchison to VodafoneThree (49% interest bought out)' where id=441;
  delete from evidence where id=676 and relationship_id=468;
  insert into relationships(source_id,target_id,relationship_type,exposure_pct,exposure_basis,exposure_qualifier,exposure_as_of,source_type,status,run_id,as_of_date,note)
    values (316,349,'invests',51,'ownership','exact','2026-03-31','annual_report','staged',48,'2026-03-31','Added by hand 2026-10-22 per admin review; quotes verified against report text (pp 20, 244)') returning id into nid;
  insert into evidence(relationship_id,section,quote,quote_found) values
   (nid,'p244','The combined business, named VodafoneThree, is 51% owned by Vodafone and 49% by CKHGT.',true),
   (nid,'p20','Following completion, VTHL is a subsidiary of the Group, in which the Group owns 51% of the issued share capital and CKHGT indirectly owns 49%, and Vodafone UK and Three UK are wholly owned subsidiaries of VTHL.',true);
  update relationships set note='Own stake only: e& 17.005026% (shared table quote p239)' where id=456;
  update relationships set note='Own stake only: BlackRock 6.50% (shared table quote p239)' where id=457;
  update relationships set note='Own stake only: Norges Bank 3.0004% (shared table quote p239)' where id=458;
end $do$;
