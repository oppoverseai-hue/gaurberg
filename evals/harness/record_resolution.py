"""Emit SQL recording entity-resolution runs (agent_runs, rules only: no model, 0 tokens, $0) and their scores after resolution.
Usage: python3 -I evals/harness/record_resolution.py runs/extractor_main_resolved ... > record.sql
Reads <ticker>_resolution_report.json and <ticker>_score.json in each folder."""
import glob, json, sys
q = lambda s: "$q$" + str(s) + "$q$"
THR = {"EXT-1": (0.90, ">="), "EXT-2": (0.60, ">="), "EXT-3": (0.95, ">="), "EXT-4": (0.90, ">="), "EXT-6": (0, "=="), "EXT-7": (0.10, "<=")}
L = ["do $do$ declare rid bigint; begin"]
for d in sys.argv[1:]:
    role = d.rstrip("/").split("/")[-1].replace("_resolved", "")
    for rf in sorted(glob.glob(f"{d}/*_resolution_report.json")):
        rep = json.load(open(rf)); t = rep["ticker"]
        sc = json.load(open(rf.replace("_resolution_report", "_score")))[t]
        L.append("insert into public.agent_runs(agent_name,mode,target,model,tokens_in,tokens_out,cost_usd,status,review_status) values "
                 f"('entity_resolution','batch',{q(t + ' resolve on ' + role + ' extraction: ' + str(rep['edges_in']) + ' edges in, ' + str(rep['edges_out']) + ' out, ' + str(len(rep['new_nodes'])) + ' new nodes; not loaded to staging')},"
                 "'rules only (no model)',0,0,0,'completed','unreviewed') returning id into rid;")
        vals = []
        for tid, (thr, op) in THR.items():
            v = sc.get(tid)
            if v is None:
                continue
            ok = {">=": v >= thr, "==": v == thr, "<=": v <= thr}[op]
            vals.append(f"(rid,{q(tid)},{q(t + ' after entity resolution (' + role + ')')},{round(v, 4)},{thr},{str(ok).lower()})")
        vals.append(f"(rid,'RUN-1',{q(t + ' resolve (' + role + '): model, tokens, cost logged (rules only: 0 tokens, $0)')},1,1,true)")
        L.append("insert into public.eval_results(run_id,test_id,metric,value,threshold,passed) values " + ",".join(vals) + ";")
L.append("end $do$;")
print("\n".join(L))
