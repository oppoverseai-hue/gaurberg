"""Market-data capability probe (Phase 1).

Calls each Finnhub and Twelve Data endpoint once per test ticker and records
what came back: OK (rows) / EMPTY / 403 (plan) / ERROR. Raw payloads are never
saved; only the status, a row count, the latest statement period and the news
count. Writes the table to stdout and docs/market_data_probe.md.

Keys: FINNHUB_API_KEY and TWELVEDATA_API_KEY from the environment. If unset,
falls back to app/.env (read in-process, never printed).

Run: python3 agents/market_data/probe.py
"""

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REPORT = ROOT / "docs" / "market_data_probe.md"

# (label, finnhub symbol, twelve data params)
TICKERS = [
    ("AAPL", "AAPL", {"symbol": "AAPL"}),
    ("UBER", "UBER", {"symbol": "UBER"}),
    ("LYFT", "LYFT", {"symbol": "LYFT"}),
    ("VOD.L", "VOD.L", {"symbol": "VOD", "exchange": "LSE"}),
    ("AML.L", "AML.L", {"symbol": "AML", "exchange": "LSE"}),
    ("SCT.L", "SCT.L", {"symbol": "SCT", "exchange": "LSE"}),
    ("CCC.L", "CCC.L", {"symbol": "CCC", "exchange": "LSE"}),
    ("BYIT.L", "BYIT.L", {"symbol": "BYIT", "exchange": "LSE"}),
]

FINNHUB_GAP = 1.1  # 60/min
TD_GAP = 8.0  # 8 credits/min
MAX_CALLS = 150


def load_keys():
    keys = {k: os.environ.get(k) for k in ("FINNHUB_API_KEY", "TWELVEDATA_API_KEY")}
    env_file = ROOT / "app" / ".env"
    if not all(keys.values()) and env_file.exists():
        for line in env_file.read_text().splitlines():
            name, _, value = line.partition("=")
            name = name.strip()
            if name in keys and not keys[name]:
                keys[name] = value.strip().strip('"').strip("'")
    missing = [k for k, v in keys.items() if not v]
    if missing:
        raise SystemExit(f"Missing keys: {', '.join(missing)}")
    return keys


class Client:
    def __init__(self, keys):
        self.keys = keys
        self.calls = 0
        self.last = {"fh": 0.0, "td": 0.0}

    def _get(self, provider, url):
        gap = FINNHUB_GAP if provider == "fh" else TD_GAP
        for attempt in range(2):
            if self.calls >= MAX_CALLS:
                return None, "ERROR", "call budget reached"
            wait = self.last[provider] + gap - time.monotonic()
            if wait > 0:
                time.sleep(wait)
            self.last[provider] = time.monotonic()
            self.calls += 1
            try:
                with urllib.request.urlopen(url, timeout=30) as r:
                    body = json.loads(r.read() or b"null")
            except urllib.error.HTTPError as e:
                if e.code == 429 and attempt == 0:
                    time.sleep(61)
                    continue
                if e.code in (401, 403):
                    return None, "403", f"HTTP {e.code}"
                return None, "ERROR", f"HTTP {e.code}"
            except Exception as e:  # network, bad JSON
                return None, "ERROR", type(e).__name__
            # Twelve Data reports errors in a 200 body.
            if provider == "td" and isinstance(body, dict) and body.get("status") == "error":
                code = body.get("code")
                if code == 429 and attempt == 0:
                    time.sleep(61)
                    continue
                msg = str(body.get("message", ""))[:80]
                if code in (401, 403):
                    return None, "403", f"{code}: {msg}"
                return None, "ERROR", f"{code}: {msg}"
            # Finnhub sometimes returns {"error": ...} with 200.
            if provider == "fh" and isinstance(body, dict) and "error" in body:
                msg = str(body["error"])[:80]
                status = "403" if "access" in msg.lower() or "premium" in msg.lower() else "ERROR"
                return None, status, msg
            return body, "OK", ""
        return None, "ERROR", "429 after retry"

    def fh(self, path, **params):
        params["token"] = self.keys["FINNHUB_API_KEY"]
        return self._get("fh", f"https://finnhub.io/api/v1{path}?{urllib.parse.urlencode(params)}")

    def td(self, path, **params):
        params["apikey"] = self.keys["TWELVEDATA_API_KEY"]
        return self._get("td", f"https://api.twelvedata.com{path}?{urllib.parse.urlencode(params)}")


def result(body, status, note, rows_fn, extra_fn=None):
    """Reduce a response to {status, rows, extra, note}. Payload is dropped here."""
    if status != "OK":
        return {"status": status, "rows": None, "extra": "", "note": note}
    try:
        rows = rows_fn(body)
        extra = extra_fn(body) if extra_fn else ""
    except Exception as e:
        return {"status": "ERROR", "rows": None, "extra": "", "note": f"unexpected shape ({type(e).__name__})"}
    return {"status": "OK" if rows else "EMPTY", "rows": rows, "extra": extra or "", "note": note}


def latest(periods):
    periods = [p for p in periods if p]
    return max(periods) if periods else ""


def probe(client, fh_sym, td_params):
    today = date.today()
    out = {}

    out["fh profile2"] = result(*client.fh("/stock/profile2", symbol=fh_sym), lambda b: 1 if b else 0)
    out["fh metric"] = result(
        *client.fh("/stock/metric", symbol=fh_sym, metric="all"),
        lambda b: len((b or {}).get("metric") or {}),
    )
    out["fh financials-reported"] = result(
        *client.fh("/stock/financials-reported", symbol=fh_sym, freq="annual"),
        lambda b: len((b or {}).get("data") or []),
        lambda b: latest([d.get("endDate", "")[:10] for d in (b.get("data") or [])]),
    )
    out["fh company-news"] = result(
        *client.fh("/company-news", symbol=fh_sym, **{"from": str(today - timedelta(days=30)), "to": str(today)}),
        lambda b: len(b or []),
        lambda b: f"{len(b)} items",
    )
    out["fh calendar/earnings"] = result(
        *client.fh("/calendar/earnings", symbol=fh_sym, **{"from": str(today), "to": str(today + timedelta(days=90))}),
        lambda b: len((b or {}).get("earningsCalendar") or []),
        lambda b: min([e.get("date", "") for e in b["earningsCalendar"]] or [""]),
    )
    out["fh price-target"] = result(
        *client.fh("/stock/price-target", symbol=fh_sym),
        lambda b: 1 if b and b.get("targetMean") else 0,
    )
    out["fh recommendation"] = result(
        *client.fh("/stock/recommendation", symbol=fh_sym),
        lambda b: len(b or []),
        lambda b: latest([r.get("period", "") for r in b]),
    )

    for name, key in (("income_statement", "income_statement"), ("balance_sheet", "balance_sheet"), ("cash_flow", "cash_flow")):
        out[f"td {name}"] = result(
            *client.td(f"/{name}", **td_params),
            lambda b, k=key: len((b or {}).get(k) or []),
            lambda b, k=key: latest([r.get("fiscal_date", "") for r in b.get(k) or []]),
        )
    out["td earnings_calendar"] = result(
        *client.td("/earnings_calendar", **td_params, start_date=str(today), end_date=str(today + timedelta(days=90))),
        lambda b: sum(len(v) for v in ((b or {}).get("earnings") or {}).values()),
        lambda b: min([d for d, v in (b.get("earnings") or {}).items() if v] or [""]),
    )
    return out


def cell(r):
    if r["status"] == "OK":
        s = f"OK ({r['rows']})"
        if r["extra"]:
            s += f" {r['extra']}"
        return s
    if r["status"] == "EMPTY":
        return "EMPTY"
    return f"{r['status']} ({r['note']})" if r["note"] else r["status"]


def main():
    client = Client(load_keys())
    started = datetime.now(timezone.utc)
    results = {}
    for label, fh_sym, td_params in TICKERS:
        print(f"probing {label} ...", flush=True)
        results[label] = probe(client, fh_sym, td_params)

    endpoints = list(next(iter(results.values())).keys())
    lines = [
        "# Market-data capability probe",
        "",
        f"Run: {started.strftime('%Y-%m-%d %H:%M UTC')}. Script: `agents/market_data/probe.py`. Calls made: {client.calls}.",
        "",
        "Cell key: OK (rows returned) plus latest period / news count / next date where relevant; "
        "EMPTY = 200 with no data; 403 = plan does not include it; ERROR = other failure. Raw payloads were not saved.",
        "",
        "Symbol formats: Finnhub uses `TICKER.L` for London; Twelve Data uses `symbol=TICKER&exchange=LSE`.",
        "",
    ]
    header = "| ticker | " + " | ".join(endpoints) + " |"
    lines.append(header)
    lines.append("|" + " --- |" * (len(endpoints) + 1))
    for label, row in results.items():
        lines.append(f"| {label} | " + " | ".join(cell(row[e]).replace("|", "/") for e in endpoints) + " |")

    # Transposed view is easier to read with 11 endpoints.
    lines += ["", "## By endpoint", "", "| endpoint | " + " | ".join(results) + " |", "|" + " --- |" * (len(results) + 1)]
    for e in endpoints:
        lines.append(f"| {e} | " + " | ".join(cell(results[t][e]).replace("|", "/") for t in results) + " |")

    text = "\n".join(lines) + "\n"
    REPORT.write_text(text)
    print()
    print(text)


if __name__ == "__main__":
    main()
