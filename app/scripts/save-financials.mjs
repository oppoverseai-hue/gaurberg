// Saves standardized statements for each company in app/data/market from SEC EDGAR XBRL "companyfacts" (10-K and 10-Q filings).
// Free, no key. Nothing is estimated or invented: a line the filer did not tag is saved as null and shown as "Not available".
// Derived lines (EBITDA, free cash flow, margins, growth, LTM) are computed here from tagged facts and labelled as derived.
// Usage: node app/scripts/save-financials.mjs [TICKER ...]
import fs from "node:fs";
import path from "node:path";

const UA = "Gaurberg research abhishek.g16@fms.edu";
const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "data", "financials");
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (url) => { await sleep(150); const r = await fetch(url, { headers: { "User-Agent": UA } }); if (!r.ok) throw new Error(`${r.status} ${url}`); return r.json(); };

const FLOW = {
  revenue: ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "RevenueFromContractWithCustomerIncludingAssessedTax", "SalesRevenueNet"],
  grossProfit: ["GrossProfit"],
  opIncome: ["OperatingIncomeLoss"],
  da: ["DepreciationDepletionAndAmortization", "DepreciationAndAmortization", "DepreciationAmortizationAndAccretionNet"],
  netIncome: ["NetIncomeLoss", "ProfitLoss"],
  eps: ["EarningsPerShareDiluted"],
  ocf: ["NetCashProvidedByUsedInOperatingActivities"],
  capex: ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets"],
};
const INST = {
  cash: ["CashAndCashEquivalentsAtCarryingValue", "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents"],
  assets: ["Assets"], liabilities: ["Liabilities"],
  equity: ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"],
  nci: ["MinorityInterest"],
  temp: ["TemporaryEquityCarryingAmountIncludingPortionAttributableToNoncontrollingInterests", "TemporaryEquityCarryingAmountAttributableToParent", "RedeemableNoncontrollingInterestEquityCarryingAmount"],
  debtTotal: ["LongTermDebt", "DebtAndCapitalLeaseObligations"],
  debtNonCurrent: ["LongTermDebtNoncurrent"], debtCurrent: ["LongTermDebtCurrent", "DebtCurrent", "ShortTermBorrowings"],
};
const days = (a, b) => (Date.parse(b) - Date.parse(a)) / 864e5;
const isFiling = (f) => /^10-[KQ]/.test(f.form);

function facts(cf, tags, unit) {
  const out = [];
  for (const tag of tags) {
    const arr = cf.facts?.["us-gaap"]?.[tag]?.units?.[unit];
    if (arr) for (const f of arr) if (isFiling(f)) out.push({ ...f, tag });
  }
  return out;
}
// Latest-filed value per (start,end) period; earlier tags in the list win when both exist.
function byPeriod(list, tags) {
  const m = new Map();
  for (const f of list) {
    const k = `${f.start ?? ""}|${f.end}`, prev = m.get(k);
    const rank = tags.indexOf(f.tag);
    if (!prev || rank < prev.rank || (rank === prev.rank && f.filed > prev.filed)) m.set(k, { ...f, rank });
  }
  return [...m.values()];
}

function build(cf) {
  const annual = {}, flowAll = {};
  for (const [k, tags] of Object.entries(FLOW)) {
    const list = byPeriod(facts(cf, tags, k === "eps" ? "USD/shares" : "USD"), tags);
    flowAll[k] = list;
    annual[k] = list.filter((f) => f.start && days(f.start, f.end) > 340 && days(f.start, f.end) < 380 && f.form.startsWith("10-K"));
  }
  const ends = [...new Set(annual.revenue.map((f) => f.end))].sort().slice(-4);
  if (!ends.length) return null;
  const lastFY = ends.at(-1);
  // LTM = latest YTD + last FY - prior-year YTD, only when a later 10-Q exists.
  const q = flowAll.revenue.filter((f) => f.form.startsWith("10-Q") && f.end > lastFY && f.start >= lastFY && days(f.start, f.end) > 80).sort((a, b) => b.end.localeCompare(a.end))[0];
  const cols = ends.map((e) => ({ label: `FY ${e.slice(0, 7)}`, end: e, kind: "FY" }));
  const val = {};
  for (const k of Object.keys(FLOW)) val[k] = ends.map((e) => annual[k].find((f) => f.end === e)?.val ?? null);
  let ltm = false;
  if (q) {
    ltm = true;
    cols.push({ label: `LTM ${q.end.slice(0, 7)}`, end: q.end, kind: "LTM" });
    const pEnd = new Date(Date.parse(q.end) - 365 * 864e5).toISOString().slice(0, 10);
    for (const k of Object.keys(FLOW)) {
      const cur = flowAll[k].find((f) => f.form.startsWith("10-Q") && f.end === q.end && f.start === q.start);
      const pri = flowAll[k].find((f) => f.form.startsWith("10-Q") && Math.abs(days(f.end, pEnd)) <= 5 && Math.abs(days(f.start, q.start) - 365) <= 5 && Math.abs(days(f.start, f.end) - days(q.start, q.end)) <= 5);
      const fy = val[k].at(-1);
      val[k].push(cur && pri && fy != null ? +(fy + cur.val - pri.val).toFixed(k === "eps" ? 2 : 0) : null);
    }
  }
  const col2end = cols.map((c) => c.end);
  const inst = {};
  for (const [k, tags] of Object.entries(INST)) {
    const list = byPeriod(facts(cf, tags, "USD"), tags).filter((f) => !f.start);
    inst[k] = col2end.map((e, i) => {
      const hit = list.filter((f) => f.end === e).sort((a, b) => a.rank - b.rank)[0];
      return hit?.val ?? null;
    });
  }
  const debt = col2end.map((_, i) => inst.debtTotal[i] ?? (inst.debtNonCurrent[i] != null ? inst.debtNonCurrent[i] + (inst.debtCurrent[i] ?? 0) : null));
  const M = (a) => a.map((v) => (v == null ? null : v / 1e6));
  const sub = (a, b) => a.map((v, i) => (v == null || b[i] == null ? null : v - b[i]));
  const add = (a, b) => a.map((v, i) => (v == null || b[i] == null ? null : v + b[i]));
  const ratio = (a, b) => a.map((v, i) => (v == null || !b[i] ? null : +((v / b[i]) * 100).toFixed(1)));
  // Growth is shown for fiscal years only: an LTM column has no prior-year LTM in the 10-K facts, so it is left empty rather than compared with a different period.
  const yoy = (a) => a.map((v, i) => { if (v == null || cols[i].kind === "LTM" || i === 0) return null; const base = a[i - 1]; return base ? +(((v - base) / Math.abs(base)) * 100).toFixed(1) : null; });
  const rev = val.revenue, ebitda = add(val.opIncome, val.da), fcf = sub(val.ocf, val.capex);
  const line = (label, values, fmt, subs = [], note) => ({ label, values: fmt === "eps" ? values : M(values), fmt, subs, note });
  const pctRow = (label, values) => ({ label, values, fmt: "pct" });
  return {
    columns: cols,
    is: [
      line("Revenue", rev, "usd", [pctRow("Growth, YoY", yoy(rev))]),
      line("Gross profit", val.grossProfit, "usd", [pctRow("Gross margin", ratio(val.grossProfit, rev))]),
      line("EBITDA (derived: operating income + D&A)", ebitda, "usd", [pctRow("EBITDA margin", ratio(ebitda, rev))]),
      line("Operating income", val.opIncome, "usd", [pctRow("Operating margin", ratio(val.opIncome, rev))]),
      line("Net income", val.netIncome, "usd", [pctRow("Net margin", ratio(val.netIncome, rev))]),
      line("EPS, diluted", val.eps, "eps"),
    ],
    bs: [
      line("Cash and equivalents", inst.cash, "usd"), line("Total debt (excludes leases where tagged separately)", debt, "usd"),
      line("Total assets", inst.assets, "usd"), line("Total liabilities", inst.liabilities, "usd"), line("Shareholders' equity (parent)", inst.equity, "usd"),
      line("Non-controlling and redeemable interests", inst.nci.map((v, i) => (v == null && inst.temp[i] == null ? null : (v ?? 0) + (inst.temp[i] ?? 0))), "usd"),
    ],
    cf: [
      line("Operating cash flow", val.ocf, "usd"), line("Capital expenditure", val.capex, "usd"),
      line("Free cash flow (derived: operating cash flow - capex)", fcf, "usd", [pctRow("FCF margin", ratio(fcf, rev))]),
    ],
    hasLtm: ltm,
    // A column whose assets differ from liabilities + equity + non-controlling/redeemable interests by 3% or more is flagged, not hidden or "fixed".
    flags: cols.flatMap((c, i) => {
      const A = inst.assets[i], L = inst.liabilities[i], E = inst.equity[i], N = (inst.nci[i] ?? 0) + (inst.temp[i] ?? 0);
      return A && L != null && E != null && Math.abs(A - L - E - N) / Math.abs(A) >= 0.03 ? [`${c.label}: balance sheet does not balance in the tagged data (assets ${Math.round(A / 1e6)}M vs liabilities + equity ${Math.round((L + E + N) / 1e6)}M); verify against the 10-K.`] : [];
    }),
  };
}

const marketDir = path.join(ROOT, "data", "market");
const tickers = process.argv.length > 2 ? process.argv.slice(2) : fs.readdirSync(marketDir).map((f) => f.replace(".json", ""));
const map = Object.values(await get("https://www.sec.gov/files/company_tickers.json"));
const summary = [];
for (const t of tickers) {
  const hit = map.find((x) => x.ticker === t);
  const base = { ticker: t, source: "SEC EDGAR XBRL companyfacts (10-K, 10-Q)", saved_at: new Date().toISOString().slice(0, 10), units: "USD millions except EPS" };
  let res;
  try {
    if (!hit) res = { ...base, status: "no_filer", note: "No SEC registrant found for this ticker (ticker unverified or no 10-K). Shown as Sample." };
    else {
      const cf = await get(`https://data.sec.gov/api/xbrl/companyfacts/CIK${String(hit.cik_str).padStart(10, "0")}.json`);
      const b = build(cf);
      res = b ? { ...base, cik: hit.cik_str, status: "ok", ...b } : { ...base, cik: hit.cik_str, status: "no_10k", note: "No US-GAAP 10-K facts (foreign filer on 20-F, or too new). Shown as Sample." };
    }
  } catch (e) { res = { ...base, status: "error", note: String(e.message) }; }
  fs.writeFileSync(path.join(OUT, `${t}.json`), JSON.stringify(res));
  summary.push(`${t}: ${res.status}${res.columns ? ` ${res.columns.length} cols${res.hasLtm ? " +LTM" : ""}` : ""}`);
}
console.log(summary.join("\n"));
