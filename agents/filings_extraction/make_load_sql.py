"""Turn a verified extraction JSON into compact SQL that writes STAGED rows only.
Usage: make_load_sql.py <extraction.json> <seed.csv> > load.sql"""
import csv, json, sys
q = lambda s: "$q$" + s + "$q$"
edges = json.load(open(sys.argv[1]))
seed = list(csv.DictReader(open(sys.argv[2])))
URL = edges[0]["document_url"]
uq = sorted({v["quote"] for e in edges for v in e["evidence"]})
qi = {t: i for i, t in enumerate(uq, 1)}
cp = {}
for e in edges:
    cp.setdefault(e["counterparty"], e["entity_type"])
skip = {"Lyft", "DoorDash"}  # already in the seed list, matched by ticker
L = ["do $do$", "declare run_id bigint; rid bigint; a bigint; b bigint; r record; k int;", "begin"]
L.append("insert into public.companies(ticker,name,segment,size_tier,is_seed,is_hero) values " + ",".join(
    f"({q(r['ticker'])},{q(r['name'])},{q(r['segment'])},{q(r['size_tier'])},true,{r['is_hero']})" for r in seed) +
    " on conflict (ticker) do update set is_seed=true, segment=excluded.segment, size_tier=excluded.size_tier, is_hero=excluded.is_hero;")
L.append("insert into public.companies(name,entity_type) select v.n,v.t from (values " + ",".join(
    f"({q(n)},{q(t)})" for n, t in sorted(cp.items()) if n not in skip) +
    ") v(n,t) where not exists (select 1 from public.companies c where lower(c.name)=lower(v.n));")
L.append("create temp table _q(i int primary key, t text) on commit drop;")
L.append("insert into _q values " + ",".join(f"({i},{q(t)})" for t, i in qi.items()) + ";")
L.append("create temp table _e(n int, ty text, s text, g text, qs int[], sec text[]) on commit drop;")
rows = []
for n, e in enumerate(edges, 1):
    qs = "{" + ",".join(str(qi[v["quote"]]) for v in e["evidence"]) + "}"
    sec = "{" + ",".join(v["section"] for v in e["evidence"]) + "}"
    rows.append(f"({n},{q(e['type'])},{q(e['source'])},{q(e['target'])},{q(qs)}::int[],{q(sec)}::text[])")
L.append("insert into _e values " + ",".join(rows) + ";")
L.append("create function pg_temp.nid(l text) returns bigint language sql as $f$ select id from public.companies where case l "
         "when 'UBER' then ticker='UBER' when 'Lyft' then ticker='LYFT' when 'DoorDash' then ticker='DASH' "
         "else lower(name)=lower(l) end order by id limit 1 $f$;")
L.append("insert into public.agent_runs(agent_name,mode,target,model,cost_usd,status,review_status) values "
         "('filings_extraction','batch','UBER FY2025 10-K (spike)','claude-sonnet-5-5 via Claude Code session',0,'completed','unreviewed') returning id into run_id;")
L.append("for r in select * from _e order by n loop "
         "a := pg_temp.nid(r.s); b := pg_temp.nid(r.g); "
         "if r.ty in ('competes','partners') and a > b then rid := a; a := b; b := rid; end if; "
         "insert into public.relationships(source_id,target_id,relationship_type,exposure_basis,source_type,status,run_id,as_of_date) "
         "values (a,b,r.ty,'none','sec_filing','staged',run_id,'2025-12-31') returning id into rid; "
         "for k in 1..array_length(r.qs,1) loop "
         f"insert into public.evidence(relationship_id,document_url,section,quote,quote_found,published_at) "
         f"select rid,{q(URL)},r.sec[k],t,true,'2026-02-13' from _q where i=r.qs[k]; end loop; end loop;")
L.append("end $do$;")
print("\n".join(L))
