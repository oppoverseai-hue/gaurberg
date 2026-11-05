"""Stage past earnings report dates from SEC 8-K item 2.02 filings (GRF-20, earnings-day reaction).

Usage: python3 -I agents/market_data/load_report_dates.py AAPL UBER ... [--out runs/m52] [--keep 4] [--today 2026-11-05]
       Tickers are US-primary seed companies (lib/listing.ts rule). Foreign issuers that file 6-K/20-F have no 8-K item 2.02.

For each ticker it reads SEC EDGAR (no key; User-Agent with a contact, at most ~7 requests a second):
  company_tickers.json -> CIK; submissions -> 8-K filings whose items include 2.02, newest first;
  each filing's index -> its exhibit 99 press release; the release must name the quarter ("third quarter 2026",
  "Q3 FY2027", "first quarter of fiscal year 2027", "quarter ended September 30, 2026"), else the filing is skipped.
The newest --keep kept filings dated before --today (New York) become report dates.

Writes to --out:
  report_dates_load.sql  ONE statement: an agent_runs row and STAGED company_events rows only
                         (source = the filing link, detail = "<quarter>, <timing>; 8-K accepted <UTC time>"). A filing already
                         stored in any status (staged, promoted, rejected) is skipped, so a rerun adds only new filings. Never touches promoted or rejected rows, companies or relationships.
  report_dates.json      every kept and skipped filing with the reason, for the review table.
Rules: a date is the New York date of the 8-K's acceptance time; nothing is estimated. No model call: tokens and cost are 0.
"""

import argparse
import html
import json
import re
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[2]
UA = "Gaurberg Research abhishek.g16@fms.edu"
GAP = 0.15
NY = ZoneInfo("America/New_York")
SCAN = 8  # newest item 2.02 filings looked at per company
ORD = {"first": 1, "second": 2, "third": 3, "fourth": 4}
MONTHS = "january|february|march|april|may|june|july|august|september|october|november|december"


def get(url, as_json=True, tries=4):
    """GET with retries (SEC drops connections under load; DNS can blip). Raises after the last try."""
    for n in range(tries):
        time.sleep(GAP if n == 0 else 2 ** n)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "identity"})
            with urllib.request.urlopen(req, timeout=30) as r:
                body = r.read()
            return json.loads(body) if as_json else body.decode("utf-8", "replace")
        except Exception:  # noqa: BLE001
            if n == tries - 1:
                raise


def exhibits_99(base, acc):
    """Every document typed EX-99.x in the filing's index page, in order (file names are arbitrary: q32026991.htm)."""
    page = get(f"{base}/{acc}-index.html", as_json=False)
    out = []
    for href, typ in re.findall(r'<a href="([^"]+)">[^<]*</a></td>\s*<td[^>]*>([^<]*)</td>', page):
        if typ.strip().upper().startswith("EX-99") and href.lower().endswith((".htm", ".html", ".txt")):
            out.append("https://www.sec.gov" + href if href.startswith("/") else f"{base}/{href.rsplit('/', 1)[-1]}")
    return out


def text_of(page):
    page = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", page)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"(?s)<[^>]+>", " ", page))).strip()


MONTH_N = {m: i + 1 for i, m in enumerate(MONTHS.split("|"))}
OPENING = 1500  # characters of the release that hold its headline and first lines
WINDOW = 120  # a release reports a quarter that ended at most this many days before the filing


def mentions(t):
    """Every quarter the text names, in reading order: (label, words, calendar end date or None for fiscal labels)."""
    out = []
    pats = [
        (r"\b(first|second|third|fourth)[-\s]+quarter\s+(?:of\s+)?(fiscal\s+(?:year\s+)?)?(?:20\d\d\s+)?(?:fiscal\s+(?:year\s+)?)?(20\d\d)\b", lambda m: (ORD[m.group(1).lower()], m.group(3), "fiscal" in m.group(0).lower())),
        (r"\b(?:fiscal\s+(?:year\s+)?)?(20\d\d)\s+(first|second|third|fourth)[-\s]+quarter\b", lambda m: (ORD[m.group(2).lower()], m.group(1), "fiscal" in m.group(0).lower())),
        (r"\bQ([1-4])\s*(FY)?\s*'?(20\d\d|\d\d)\b", lambda m: (int(m.group(1)), m.group(3) if len(m.group(3)) == 4 else f"20{m.group(3)}", bool(m.group(2)))),
        (r"\b(first|second|third|fourth)[-\s]+quarter[-\s]+and[-\s]+(?:full[-\s]+year|fiscal(?:[-\s]+year)?)[-\s]+(20\d\d)\b", lambda m: (ORD[m.group(1).lower()], m.group(2), "fiscal" in m.group(0).lower())),
        (r"\bQ([1-4])\s+and\s+(?:full\s+)?(?:FY|fiscal\s+year)\s*'?(20\d\d|\d\d)\b", lambda m: (int(m.group(1)), m.group(2) if len(m.group(2)) == 4 else f"20{m.group(2)}", True)),
    ]
    for pat, parse in pats:
        for m in re.finditer(pat, t, re.I if not pat.startswith("\\bQ") else 0):
            q, y, fiscal = parse(m)
            end = None if fiscal else datetime(int(y), 3 * q, [31, 30, 30, 31][q - 1]).date()
            out.append((m.start(), f"Q{q} {'FY' if fiscal else ''}{y}", m.group(0), end, near_results(t, m)))
    for m in re.finditer(rf"\bquarter\s+ended\s+({MONTHS})\s+(\d{{1,2}}),\s+(20\d\d)\b", t, re.I):
        end = datetime(int(m.group(3)), MONTH_N[m.group(1).lower()], int(m.group(2))).date()
        out.append((m.start(), f"quarter ended {end.isoformat()}", m.group(0), end, near_results(t, m)))
    seen, uniq = set(), []
    for x in sorted(out):  # one mention per position (two patterns can match the same words)
        if x[0] not in seen:
            seen.add(x[0]); uniq.append(x[1:])
    return uniq


def near_results(t, m):
    """True when "results" sits next to the mention: "Third Quarter 2026 Results", "results for the fourth quarter"."""
    return bool(re.search(r"results", t[max(0, m.start() - 40):m.end() + 40], re.I))


# An update filed under item 2.02 that is not the quarter's report: "Lucid Announces Q3 Production and Deliveries, Sets Date for
# Third Quarter 2026 Earnings". Read from the release's opening only.
UPDATE = re.compile(r"production\s+(?:and|&)\s+deliveries|vehicle\s+deliveries|sets\s+date\s+for|to\s+announce\s+.{0,40}results\s+on", re.I)
RESULTS = re.compile(r"\b(revenues?|net (?:income|loss)|financial results|earnings per share|diluted (?:eps|earnings))\b", re.I)


def quarter_named(text, filed):
    """The quarter the release reports. An update (production and deliveries, the date of the report) or a release that reports
    no financial results names none. Otherwise, in this order:
    1. the first fiscal label in the release's opening, its headline ("Fourth Quarter and Fiscal 2026", "Q4 and FY 2026"),
       within a year of the filing: a fiscal label cannot be checked against a date, so only the headline's counts;
    2. the most recent dated quarter, calendar ("third quarter 2026") or "quarter ended <date>", that ended within WINDOW days
       before the filing: a year-ago comparison is older and next quarter's guidance has not ended; a calendar label and one
       named next to "results" win a tie."""
    t = text[:60000]  # the whole release: a shareholder letter may name the quarter ("Q4'25") and its results well after the opening
    if UPDATE.search(t[:600]):
        return "update"
    if not RESULTS.search(t):
        return "no-results"
    fis = [(l, w) for l, w, e, r in mentions(t[:OPENING]) if "FY" in l and abs(int(l[-4:]) - filed.year) <= 1]
    if fis:
        return fis[0]
    dated = [(e, l.startswith("Q"), r, l, w) for l, w, e, r in mentions(t) if e is not None and 0 <= (filed - e).days <= WINDOW]
    if dated:
        best = max(dated, key=lambda x: x[:3])
        return best[3], best[4]
    return None


def timing_words(dt_utc):
    ny = dt_utc.astimezone(NY)
    mins = ny.hour * 60 + ny.minute
    return "before market open" if mins < 570 else "after market close" if mins >= 960 else "during market hours"


SELFTEST = [  # (release text, filing date, expected quarter) from real releases that the first runs read wrongly (Nov 5, 2026)
    ("Intel Reports Fourth-Quarter and Full-Year 2025 Financial Results. compared with third quarter of 2025. Q4 2025 revenue was $1 billion", "2026-01-22", "Q4 2025"),
    ("Tesla Third Quarter 2026 Vehicle Production & Deliveries. produced 400,000 vehicles", "2026-10-02", "update"),
    ("Oracle Announces Fiscal Year 2026 Fourth Quarter and Fiscal Full Year Financial Results. revenue. Q1 FY 2027 outlook", "2026-06-10", "Q4 FY2026"),
    ("Instacart Fourth Quarter and Full Year 2025 results. revenue", "2026-02-12", "Q4 2025"),
    ("Meta Reports Fourth Quarter and Full Year 2025 Results. third quarter of 2025. revenue", "2026-01-28", "Q4 2025"),
    ("AMAZON.COM ANNOUNCES THIRD QUARTER RESULTS. compared with third quarter 2025. Fourth Quarter 2026 Guidance. revenue", "2026-10-29", None),
    ("Uber Announces Results for Third Quarter 2026. revenue", "2026-11-04", "Q3 2026"),
    ("Apple reports fourth quarter results. fiscal 2026 fourth quarter. revenue", "2026-10-29", "Q4 FY2026"),
    ("NVIDIA Announces Financial Results for Third Quarter Fiscal 2027. revenue", "2026-11-19", "Q3 FY2027"),
    ("Lucid Announces Q3 Production and Deliveries, Sets Date for Third Quarter 2026 Earnings. financial results, net income", "2026-10-05", "update"),
    ("Oracle Announces Record Q4 and FY 2026 Results. Q1 FY 2027 outlook. Record Q4 Earnings per Share", "2026-06-10", "Q4 FY2026"),
    ("Second Quarter 2026 Shareholder Letter. The second quarter represented a leap forward." + " text" * 1500 + " net loss of $200 million", "2026-07-29", "Q2 2026"),
    ("NVIDIA Announces Financial Results for Fourth Quarter and Fiscal 2026. revenue." + " text" * 400 + " Outlook for the first quarter of fiscal 2027", "2026-02-25", "Q4 FY2026"),
    ("Applied Digital Reports Results. for the quarter ended August 31, 2026. revenue." + " text" * 400 + " compared with the fiscal second quarter 2026", "2026-10-07", "quarter ended 2026-08-31"),
    ("Dear Shareholders, We wrapped up 2025 with real momentum." + " text" * 1500 + " Q4'25 GTV grew. compared with Q4'24. revenue", "2026-02-12", "Q4 2025"),
]


def selftest():
    bad = 0
    for text, filed, want in SELFTEST:
        got = quarter_named(text, datetime.fromisoformat(filed).date())
        got = got if got is None or isinstance(got, str) else got[0]
        bad += got != want
        print("ok " if got == want else "BAD", filed, want, "->", got)
    print("selftest", "failed" if bad else "passed")
    raise SystemExit(1 if bad else 0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--selftest", action="store_true", help="check the quarter rules on known releases and exit")
    ap.add_argument("tickers", nargs="*")
    ap.add_argument("--out", default="runs/m52")
    ap.add_argument("--keep", type=int, default=4)
    ap.add_argument("--today", default=datetime.now(NY).date().isoformat())
    a = ap.parse_args()
    if a.selftest:
        selftest()
    out = ROOT / a.out
    out.mkdir(parents=True, exist_ok=True)
    started = datetime.now(timezone.utc)
    ciks = {v["ticker"].upper(): str(v["cik_str"]) for v in get("https://www.sec.gov/files/company_tickers.json").values()}
    report = {"today": a.today, "keep": a.keep, "companies": {}}
    rows = []
    for t in a.tickers:
        t = t.upper()
        rec = {"cik": ciks.get(t), "kept": [], "skipped": [], "note": None}
        report["companies"][t] = rec
        if not rec["cik"]:
            rec["note"] = "no SEC CIK for this ticker"
            continue
        try:
            sub = get(f"https://data.sec.gov/submissions/CIK{rec['cik'].zfill(10)}.json")
        except Exception as e:  # noqa: BLE001
            rec["note"] = f"submissions not readable: {e}"
            continue
        r = sub["filings"]["recent"]
        forms = set(r["form"])
        cands = [i for i in range(len(r["form"])) if r["form"][i] == "8-K" and "2.02" in (r["items"][i] or "").split(",")]
        if not cands:
            rec["note"] = "no 8-K item 2.02 filings" + (" (files 6-K/20-F as a foreign private issuer)" if forms & {"6-K", "20-F"} else "")
            continue
        for i in cands[:SCAN]:
            acc = r["accessionNumber"][i]
            accepted = datetime.fromisoformat(r["acceptanceDateTime"][i].replace("Z", "+00:00")).astimezone(timezone.utc)
            day = accepted.astimezone(NY).date().isoformat()
            base = f"https://www.sec.gov/Archives/edgar/data/{rec['cik']}/{acc.replace('-', '')}"
            f = {"accession": acc, "date": day, "accepted_utc": accepted.strftime("%Y-%m-%dT%H:%M:%SZ"), "filing": f"{base}/{r['primaryDocument'][i]}", "items": r["items"][i]}
            if len(rec["kept"]) >= a.keep:
                break
            if day >= a.today:
                rec["skipped"].append({**f, "reason": f"dated {day}, not before {a.today}"})
                continue
            try:
                exs = exhibits_99(base, acc)
                if not exs:
                    rec["skipped"].append({**f, "reason": "no document typed EX-99 in the filing"})
                    continue
                q, seen = None, []
                for ex in exs:  # the release may be 99.2 when 99.1 is a shareholder letter
                    q = quarter_named(text_of(get(ex, as_json=False)), accepted.astimezone(NY).date())
                    seen.append(q)
                    if q and q not in ("no-results", "update"):
                        f["release"] = ex
                        break
                else:
                    q = None
            except Exception as e:  # noqa: BLE001
                rec["skipped"].append({**f, "reason": f"filing not readable: {e}"})
                continue
            if not q:
                why = ("exhibit 99 is an update, not the quarter's report (production and deliveries, or the date of the report)" if "update" in seen
                       else "exhibit 99 reports no financial results" if all(x == "no-results" for x in seen)
                       else f"exhibit 99 names no quarter that ended in the {WINDOW} days before the filing")
                rec["skipped"].append({**f, "reason": why, "exhibits": exs})
                continue
            if any(k["quarter"] == q[0] for k in rec["kept"]):
                rec["skipped"].append({**f, "release": f["release"], "reason": f"names {q[0]}, the same quarter as a newer kept filing"})
                continue
            f["quarter"], f["named_as"] = q
            f["timing"] = timing_words(accepted)
            rec["kept"].append(f)
            rows.append((t, f))
    (out / "report_dates.json").write_text(json.dumps(report, indent=1))

    def q(s):
        return "'" + s.replace("'", "''") + "'"
    target = f"SEC 8-K item 2.02 report dates, last {a.keep} per company before {a.today} ({len(rows)} staged)"
    values = ",\n  ".join(f"({q(t)}, date {q(f['date'])}, {q(f['quarter'] + ', ' + f['timing'] + '; 8-K accepted ' + f['accepted_utc'])}, {q(f['filing'])})" for t, f in rows)
    sql = f"""-- Generated {started.strftime('%Y-%m-%d %H:%M UTC')} by agents/market_data/load_report_dates.py (GRF-20). STAGED rows only; review runs/m52/review.md first.
with run as (
  insert into public.agent_runs(agent_name, mode, target, model, tokens_in, tokens_out, cost_usd, status, review_status, started_at, finished_at)
  values ('report_dates', 'batch', {q(target)}, 'none (SEC EDGAR, no model call)', 0, 0, 0, 'completed', 'unreviewed', {q(started.isoformat())}, now())
  returning id
), v(ticker, event_date, detail, source) as (values
  {values}
)
insert into public.company_events(company_id, event_date, event_type, detail, source, status, run_id)
select c.id, v.event_date, 'earnings', v.detail, v.source, 'staged', run.id
from v join public.companies c on c.ticker = v.ticker and c.is_seed cross join run
-- A filing already stored in any status (staged, promoted or rejected) is left alone: no second copy, nothing revived.
where not exists (select 1 from public.company_events e where e.company_id = c.id and e.event_date = v.event_date
                  and e.event_type = 'earnings' and e.source = v.source)
on conflict (company_id, event_date, event_type, source) where status = 'staged' do nothing
returning company_id, event_date, source;
"""
    (out / "report_dates_load.sql").write_text(sql)
    print(f"kept {len(rows)}; companies with a note: {sum(1 for c in report['companies'].values() if c['note'])}; skipped filings: {sum(len(c['skipped']) for c in report['companies'].values())}")


if __name__ == "__main__":
    main()
