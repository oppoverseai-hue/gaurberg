"""Load market metrics, analyst recommendation trends and upcoming earnings dates from Finnhub (M17, DEM-1).

Usage: python3 agents/market_data/load_fundamentals.py AAPL UBER VOD.L [--out runs/m17]
       Symbols are Finnhub symbols: US tickers as-is, London with ".L". The company is matched on the ticker before the dot.

For each symbol it calls /stock/profile2, /stock/metric?metric=all, /stock/recommendation and /calendar/earnings (next 90 days),
then writes two files to --out:
  <TICKER>_load.sql  writes STAGED rows only (company_metrics, company_events) and one agent_runs row. Apply it to Supabase
                     the same way as the other agents' load SQL. Re-running is safe: metrics upsert on company_id + as_of + source,
                     and staged future earnings rows for the company are replaced. Promoted or rejected rows are never touched:
                     every date the run lists is staged, even if a promoted row already holds it (promotion then drops the copy).
  <TICKER>_run.json  per-endpoint status and the fields that came back empty. No raw payloads are saved.

Rules: a missing value is NULL with the reason in note, never an estimate. Analyst EPS and revenue estimates in the earnings
calendar are not stored. Never writes companies or relationships. No model call, so tokens and cost are 0.
Keys: FINNHUB_API_KEY from the environment, else app/.env (same as save-market.mjs). Never printed. Rate limit: 60 calls/min.
"""

import argparse
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GAP = 1.1  # seconds between Finnhub calls (60/min)
TARGET = "{sym} Finnhub metric, recommendation trends, earnings calendar (M17)"

# company_metrics column -> Finnhub /stock/metric key. Explicit, one key per column; no fallbacks.
METRIC_KEYS = {
    "pe_ttm": "peTTM",
    "ev_ebitda": "evEbitdaTTM",
    "gross_margin": "grossMarginTTM",
    "operating_margin": "operatingMarginTTM",
    "net_margin": "netProfitMarginTTM",
    "revenue_growth_yoy": "revenueGrowthTTMYoy",
    "debt_to_equity": "totalDebt/totalEquityQuarterly",
}
REC_KEYS = {"rec_strong_buy": "strongBuy", "rec_buy": "buy", "rec_hold": "hold", "rec_sell": "sell", "rec_strong_sell": "strongSell"}
HOUR = {"bmo": "before market open", "amc": "after market close", "dmh": "during market hours"}


def finnhub_key():
    key = os.environ.get("FINNHUB_API_KEY")
    env_file = ROOT / "app" / ".env"
    if not key and env_file.exists():
        for line in env_file.read_text().splitlines():
            name, _, value = line.partition("=")
            if name.strip() == "FINNHUB_API_KEY":
                key = value.strip().strip('"').strip("'")
    if not key:
        raise SystemExit("FINNHUB_API_KEY is not set")
    return key


class Finnhub:
    def __init__(self, key):
        self.key, self.last = key, 0.0

    def get(self, path, **params):
        """Returns (json or None, status). status is 'ok' or a short reason. Retries once on 429."""
        params["token"] = self.key
        url = f"https://finnhub.io/api/v1{path}?{urllib.parse.urlencode(params)}"
        for attempt in range(2):
            wait = self.last + GAP - time.monotonic()
            if wait > 0:
                time.sleep(wait)
            self.last = time.monotonic()
            try:
                with urllib.request.urlopen(url, timeout=30) as r:
                    body = json.loads(r.read() or b"null")
            except urllib.error.HTTPError as e:
                if e.code == 429 and attempt == 0:
                    time.sleep(61)
                    continue
                return None, f"HTTP {e.code}" + (" (not on the free plan)" if e.code == 403 else "")
            except Exception as e:
                return None, f"error ({type(e).__name__})"
            if isinstance(body, dict) and "error" in body:
                return None, f"error ({str(body['error'])[:60]})"
            return body, "ok"
        return None, "HTTP 429 after retry"


def num(v):
    return v if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def q(v):
    if v is None:
        return "null"
    if isinstance(v, (int, float)):
        return repr(v)
    return "$q$" + str(v) + "$q$"


def fetch(fh, sym, today):
    run = {"symbol": sym, "endpoints": {}, "missing": []}
    t0 = datetime.now(timezone.utc)

    profile, run["endpoints"]["profile2"] = fh.get("/stock/profile2", symbol=sym)
    if run["endpoints"]["profile2"] == "ok" and not profile:
        run["endpoints"]["profile2"] = "empty"

    metric, st = fh.get("/stock/metric", symbol=sym, metric="all")
    m = (metric or {}).get("metric") or {}
    run["endpoints"]["metric"] = st if st != "ok" else ("ok" if m else "empty")

    recs, st = fh.get("/stock/recommendation", symbol=sym)
    run["endpoints"]["recommendation"] = st if st != "ok" else ("ok" if recs else "empty")

    cal, st = fh.get("/calendar/earnings", symbol=sym, **{"from": str(today), "to": str(today + timedelta(days=90))})
    events = (cal or {}).get("earningsCalendar") or []
    run["endpoints"]["calendar/earnings"] = st if st != "ok" else ("ok" if events else "empty")
    run["fetch_started"], run["fetch_finished"] = t0.isoformat(), datetime.now(timezone.utc).isoformat()

    metrics = None
    if m or recs:
        metrics = {col: num(m.get(key)) for col, key in METRIC_KEYS.items()}
        for col, key in METRIC_KEYS.items():
            if metrics[col] is None:
                run["missing"].append(key if m else f"{key} (metric {run['endpoints']['metric']})")
        periods = [p.get("period") for s in ((metric or {}).get("series") or {}).get("quarterly", {}).values() for p in s[:1] if isinstance(p, dict)]
        metrics["data_period"] = max([p for p in periods if p] or [None], key=lambda p: p or "")
        latest = max(recs or [], key=lambda r: r.get("period", ""), default=None)
        metrics["rec_period"] = latest.get("period") if latest else None
        for col, key in REC_KEYS.items():
            metrics[col] = num(latest.get(key)) if latest else None
        if not latest:
            run["missing"].append(f"recommendation trends ({run['endpoints']['recommendation']})")

    rows = []
    for e in events:
        d = e.get("date")
        if not d:
            continue
        bits = []
        if e.get("quarter") and e.get("year"):
            bits.append(f"Q{e['quarter']} {e['year']}")
        if HOUR.get(e.get("hour")):
            bits.append(HOUR[e["hour"]])
        rows.append({"event_date": d, "detail": ", ".join(bits) or None})
    return run, metrics, rows


def build_sql(sym, run, metrics, events, today):
    ticker = sym.split(".")[0].upper()
    eps = run["endpoints"]
    ok = [k for k in ("metric", "recommendation", "calendar/earnings") if eps[k] == "ok"]
    if not ok:
        status = "failed: " + "; ".join(f"{k} {v}" for k, v in eps.items())
    elif len(ok) < 3 or run["missing"]:
        # Name the failed endpoints: promotion must not treat a failed calendar call as "no upcoming events".
        bad = [f"{k} {v}" for k, v in eps.items() if k != "profile2" and v not in ("ok", "empty")]
        status = "completed_with_gaps" + (": " + "; ".join(bad) if bad else "")
    else:
        status = "completed"
    run["status"] = status
    note = ("missing from Finnhub: " + ", ".join(run["missing"])) if run["missing"] else None

    L = ["do $do$", "declare run_id bigint; cid bigint;", "begin",
         f"select id into cid from public.companies where ticker={q(ticker)};",
         f"if cid is null then raise exception 'company % not found', {q(ticker)}; end if;",
         "insert into public.agent_runs(agent_name,mode,target,model,tokens_in,tokens_out,cost_usd,started_at,finished_at,status,review_status) values "
         f"('market_data','batch',{q(TARGET.format(sym=sym))},'none (Finnhub API, no model call)',0,0,0,"
         f"{q(run['fetch_started'])}::timestamptz,{q(run['fetch_finished'])}::timestamptz,{q(status)},'unreviewed') returning id into run_id;"]
    if metrics:
        cols = ["as_of", "data_period", *METRIC_KEYS, "rec_period", *REC_KEYS]
        vals = [q(str(today)) + "::date", q(metrics["data_period"]) + ("::date" if metrics["data_period"] else ""),
                *(q(metrics[c]) for c in METRIC_KEYS), q(metrics["rec_period"]) + ("::date" if metrics["rec_period"] else ""),
                *(q(metrics[c]) for c in REC_KEYS)]
        upd = ",".join(f"{c}=excluded.{c}" for c in [*cols[1:], "fetched_at", "run_id", "note"])
        L.append(f"insert into public.company_metrics(company_id,{','.join(cols)},source,fetched_at,status,run_id,note) values "
                 f"(cid,{','.join(vals)},'finnhub',{q(run['fetch_finished'])}::timestamptz,'staged',run_id,{q(note)}) "
                 f"on conflict (company_id,as_of,source) do update set {upd} where public.company_metrics.status='staged';")
    if eps["calendar/earnings"] in ("ok", "empty"):
        # The calendar is the current truth: drop staged future dates it no longer lists (a moved date), then upsert.
        keep = ",".join(q(e["event_date"]) + "::date" for e in events) or "null"
        L.append(f"delete from public.company_events where company_id=cid and source='finnhub' and status='staged' "
                 f"and event_date>={q(str(today))}::date and event_date not in ({keep});")
        for e in events:
            L.append("insert into public.company_events(company_id,event_date,event_type,detail,source,fetched_at,status,run_id) values "
                     f"(cid,{q(e['event_date'])}::date,'earnings',{q(e['detail'])},'finnhub',{q(run['fetch_finished'])}::timestamptz,'staged',run_id) "
                     "on conflict (company_id,event_date,event_type,source) where status='staged' "
                     "do update set detail=excluded.detail,fetched_at=excluded.fetched_at,run_id=excluded.run_id;")
    L.append("end $do$;")
    return ticker, "\n".join(L) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("symbols", nargs="+")
    ap.add_argument("--out", default=str(ROOT / "runs" / "m17"))
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    fh, today = Finnhub(finnhub_key()), datetime.now(timezone.utc).date()
    for sym in a.symbols:
        run, metrics, events = fetch(fh, sym, today)
        ticker, sql = build_sql(sym, run, metrics, events, today)
        (out / f"{ticker}_load.sql").write_text(sql)
        (out / f"{ticker}_run.json").write_text(json.dumps({**run, "events": len(events)}, indent=1) + "\n")
        print(f"{sym}: {run['status']}; endpoints {run['endpoints']}; events {len(events)}"
              + (f"; missing {', '.join(run['missing'])}" if run["missing"] else ""))


if __name__ == "__main__":
    main()
