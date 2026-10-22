"""Turn <ticker>_geo.json (from run_geo.py) into one staging SQL block for company_geo_revenue (M16). Rows are `staged`. Nothing is promoted.

Usage: python3 -I agents/filings_extraction/make_geo_sql.py runs/m16/vod_geo.json > runs/m16/vod_geo_load.sql
The block is atomic. It also records the model call in agent_runs (RUN-1)."""
import json, sys


def q(s):
    return "null" if s is None else "$q$" + str(s) + "$q$"


def n(x):
    return "null" if x is None else repr(x)


j = json.load(open(sys.argv[1]))
u = j["usage"]
tin = u["input_tokens"] + u["cache_creation_tokens"] + u["cache_read_tokens"]
out = ["do $do$", "declare run_id bigint; cid bigint;", "begin",
       f"select id into cid from public.companies where ticker={q(j['ticker'])};",
       "if cid is null then raise exception 'company % not found', " + q(j["ticker"]) + "; end if;",
       "insert into public.agent_runs(agent_name,mode,target,model,tokens_in,tokens_out,cost_usd,status,review_status) values "
       f"('geo_revenue','batch',{q(j['ticker'] + ' geographic revenue ' + j['document'] + ' (M16)')},{q(j['model'] + ' via Claude Code session')},{tin},{u['output_tokens']},{round(u['cost_usd'], 4)},'completed','unreviewed') returning id into run_id;"]
for r in j["rows"]:
    note = r.get("note")
    if r.get("pct_basis") == "computed":
        note = ((note + "; ") if note else "") + "share = row amount / group revenue stated in the same report; rows may not add to 100% (central lines are not a geography)"
    out.append("insert into public.company_geo_revenue(company_id,country,label,bucket_region,revenue_pct,revenue_amount,currency,unit,period_end,pct_basis,source_type,status,run_id,section,quote,quote_found,note) values "
               f"(cid,{q(r.get('country'))},{q(r['label'])},{q(r.get('bucket_region'))},{n(r.get('revenue_pct'))},{n(r.get('revenue_amount'))},{q(r.get('currency'))},{q(r.get('unit'))},{q(r['period_end'])}::date,"
               f"{q(r.get('pct_basis') or 'stated')},'annual_report','staged',run_id,{q('p' + str(r.get('page')))},{q(r.get('quote'))},{str(bool(r['quote_found'])).lower()},{q(note)});")
out += ["end $do$;"]
print("\n".join(out))
