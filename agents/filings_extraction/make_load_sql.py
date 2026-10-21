"""Turn a verified extraction JSON into compact SQL that writes STAGED rows only.
Usage: make_load_sql.py <extraction.json> <seed.csv> [--ticker UBER] [--filed 2026-02-13]
       [--aliases "Lyft=LYFT,DoorDash=DASH"] [--target "UBER FY2025 10-K (spike)"] > load.sql
--aliases maps counterparty labels that are already seed companies to their tickers (no new node is made)."""
import argparse, csv, json, sys
q = lambda s: "$q$" + s + "$q$"
ap = argparse.ArgumentParser()
ap.add_argument("extraction"); ap.add_argument("seed")
ap.add_argument("--ticker", default="UBER"); ap.add_argument("--filed", default="2026-02-13")
ap.add_argument("--aliases", default="Lyft=LYFT,DoorDash=DASH")
ap.add_argument("--target", default="UBER FY2025 10-K (spike)")
a = ap.parse_args()
edges = json.load(open(a.extraction))
seed = list(csv.DictReader(open(a.seed)))
alias = dict(x.split("=") for x in a.aliases.split(",") if x)
alias[a.ticker] = a.ticker
URL = edges[0]["document_url"]
uq = sorted({v["quote"] for e in edges for v in e["evidence"]})
qi = {t: i for i, t in enumerate(uq, 1)}
cp = {}
for e in edges:
    cp.setdefault(e["counterparty"], e["entity_type"])
skip = set(alias)  # already in the seed list, matched by ticker
L = ["do $do$", "declare run_id bigint; rid bigint; a bigint; b bigint; r record; k int;", "begin"]
L.append("insert into public.companies(ticker,name,segment,size_tier,is_seed,is_hero) values " + ",".join(
    f"({q(r['ticker'])},{q(r['name'])},{q(r['segment'])},{q(r['size_tier'])},true,{r['is_hero']})" for r in seed) +
    " on conflict (ticker) do update set is_seed=true, segment=excluded.segment, size_tier=excluded.size_tier, is_hero=excluded.is_hero;")
L.append("insert into public.companies(name,entity_type) select v.n,v.t from (values " + ",".join(
    f"({q(n)},{q(t)})" for n, t in sorted(cp.items()) if n not in skip) +
    ") v(n,t) where not exists (select 1 from public.companies c where lower(c.name)=lower(v.n));")
L.append("create temp table _q(i int primary key, t text) on commit drop;")
L.append("insert into _q values " + ",".join(f"({i},{q(t)})" for t, i in qi.items()) + ";")
L.append("create temp table _e(n int, ty text, s text, g text, qs int[], sec text[], pct numeric, qual text, basis text, note text) on commit drop;")
rows = []
for n, e in enumerate(edges, 1):
    qs = "{" + ",".join(str(qi[v["quote"]]) for v in e["evidence"]) + "}"
    sec = "{" + ",".join(v["section"] for v in e["evidence"]) + "}"
    pct = e.get("exposure_pct")
    rows.append(f"({n},{q(e['type'])},{q(e['source'])},{q(e['target'])},{q(qs)}::int[],{q(sec)}::text[],"
                f"{'null' if pct is None else pct},{'null' if pct is None else q(e.get('exposure_qualifier') or 'exact')},"
                f"{'null' if pct is None else q(e.get('exposure_basis') or 'source_revenue')},"
                f"{'null' if not e.get('note') else q(e['note'])})")
L.append("insert into _e values " + ",".join(rows) + ";")
L.append("create function pg_temp.nid(l text) returns bigint language sql as $f$ select id from public.companies where case l "
         + " ".join(f"when {q(k)} then ticker={q(v)}" for k, v in alias.items()) +
         " else lower(name)=lower(l) end order by id limit 1 $f$;")
L.append("insert into public.agent_runs(agent_name,mode,target,model,cost_usd,status,review_status) values "
         f"('filings_extraction','batch',{q(a.target)},'claude-sonnet-5-5 via Claude Code session',0,'completed','unreviewed') returning id into run_id;")
L.append("for r in select * from _e order by n loop "
         "a := pg_temp.nid(r.s); b := pg_temp.nid(r.g); "
         "if r.ty in ('competes','partners') and a > b then rid := a; a := b; b := rid; end if; "
         "rid := null; select id into rid from public.relationships where source_id=a and target_id=b and relationship_type=r.ty order by id limit 1; "
         "if rid is null then "
         "insert into public.relationships(source_id,target_id,relationship_type,exposure_pct,exposure_qualifier,exposure_basis,exposure_as_of,source_type,status,run_id,as_of_date,note) "
         "values (a,b,r.ty,r.pct,r.qual,case when r.pct is null then 'none' else r.basis end,case when r.pct is null then null else '2025-12-31'::date end,'sec_filing','staged',run_id,'2025-12-31',r.note) returning id into rid; end if; "
         "for k in 1..array_length(r.qs,1) loop "
         f"insert into public.evidence(relationship_id,document_url,section,quote,quote_found,published_at) "
         f"select rid,{q(URL)},r.sec[k],t,true,{q(a.filed)} from _q where i=r.qs[k]; end loop; end loop;")
L.append("end $do$;")
print("\n".join(L))
