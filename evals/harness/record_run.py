"""Emit SQL that records re-run extraction runs (agent_runs, RUN-1) and their scores (eval_results).
Usage: python3 -I evals/harness/record_run.py runs/extractor_small runs/extractor_main > record.sql
Reads <ticker>_run.json (tokens, cost) and <ticker>_score.json (scorer --out). EXT-7 uses the admin-confirmed negatives."""
import glob, json, pathlib, sys
q = lambda s: "$q$" + str(s) + "$q$"
THR = {"EXT-1": 0.90, "EXT-2": 0.60, "EXT-3": 0.95, "EXT-4": 0.90, "EXT-6": 0, "EXT-7": 0.10}
PASS = {"EXT-1": ">=", "EXT-2": ">=", "EXT-3": ">=", "EXT-4": ">=", "EXT-6": "==", "EXT-7": "<="}
NAME = {"EXT-1": "edge precision", "EXT-2": "edge recall", "EXT-3": "direction accuracy", "EXT-4": "type accuracy", "EXT-6": "unsupported edges", "EXT-7": "false-positive rate vs confirmed negatives"}
L = ["do $do$ declare rid bigint; begin"]
for d in sys.argv[1:]:
    for rf in sorted(glob.glob(f"{d}/*_run.json")):
        run = json.load(open(rf)); t = run["ticker"]
        sc = json.load(open(rf.replace("_run.json", "_score.json")))[t]
        tot = run["totals"]; tin = tot["input_tokens"] + tot["cache_creation_tokens"] + tot["cache_read_tokens"]
        L.append("insert into public.agent_runs(agent_name,mode,target,model,tokens_in,tokens_out,cost_usd,status,review_status) values "
                 f"('filings_extraction','batch',{q(t + ' FY2025 10-K, model comparison re-run (' + run['role'] + '); not loaded to staging')},"
                 f"{q(run['model'] + ' via claude -p')},{tin},{tot['output_tokens']},{round(tot['cost_usd'], 4)},'completed','unreviewed') returning id into rid;")
        rows = [("RUN-1", f"{t} {run['role']}: this run has model, tokens and cost logged", 1.0, 1.0, True)]
        for tid, thr in THR.items():
            v = sc[tid]
            ok = {">=": v >= thr, "==": v == thr, "<=": v <= thr}[PASS[tid]]
            rows.append((tid, f"{t} {NAME[tid]} ({run['role']}, {sc['counts']['predicted']} predicted, {sc['counts']['gold_true']} gold)", v, thr, ok))
        L.append("insert into public.eval_results(run_id,test_id,metric,value,threshold,passed) values " +
                 ",".join(f"(rid,{q(a)},{q(b)},{round(c, 4)},{e},{str(f).lower()})" for a, b, c, e, f in [(r[0], r[1], r[2], r[3], r[4]) for r in rows]) + ";")
L.append("end $do$;")
print("\n".join(L))
