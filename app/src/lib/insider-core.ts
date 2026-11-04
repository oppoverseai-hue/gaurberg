// Insider trades (SMX-3, NFR-1): reading SEC Form 4 filings, by a program (no AI model). Pure functions: no data access here.
// Only open-market buys (code P) and sells (code S) count; grants, exercises and tax withholding do not.
// A filing where the company is the reporting owner of another issuer ("Uber sells Aurora shares") is not an insider trade in it.

export type Trade = { insider: string; role: string; side: "Buy" | "Sell"; shares: number; price: number | null; date: string; filed: string; url: string; line: number };
export type Recent = { form: string[]; filingDate: string[]; accessionNumber: string[]; primaryDocument: string[] };
export type Pick = { acc: string; file: string; filed: string };

export const DAYS = 90, MAX_FILINGS = 15;

const tag = (x: string, t: string) => x.match(new RegExp(`<${t}>\\s*([\\s\\S]*?)\\s*</${t}>`))?.[1];
const val = (x: string, t: string) => { const b = tag(x, t); return b ? (tag(b, "value") ?? b.replace(/<[^>]+>/g, "").trim()) : undefined; };

/** The Form 4 filings to read: filed within `days` of `now`, newest first, at most `max`. */
export function pickFilings(r: Recent, now: number, days = DAYS, max = MAX_FILINGS): Pick[] {
  const cutoff = now - days * 86400_000, picks: Pick[] = [];
  for (let i = 0; i < r.form.length && picks.length < max; i++) {
    if (r.form[i] !== "4" || Date.parse(r.filingDate[i]) < cutoff) continue;
    picks.push({ acc: r.accessionNumber[i].replace(/-/g, ""), file: r.primaryDocument[i].split("/").pop()!, filed: r.filingDate[i] });
  }
  return picks;
}

export const filingUrl = (cik: string, p: Pick) => `https://www.sec.gov/Archives/edgar/data/${parseInt(cik, 10)}/${p.acc}/${p.file}`;

/** Open-market buys and sells in one Form 4, when `cik` is the issuer. `line` is the transaction's place in the filing. */
export function parseForm4(xml: string, cik: string, filed: string, url: string): Trade[] {
  if (parseInt(val(xml, "issuerCik") ?? "0", 10) !== parseInt(cik, 10)) return [];
  const insider = val(xml, "rptOwnerName") ?? "Unknown";
  const rel = tag(xml, "reportingOwnerRelationship") ?? "";
  const role = val(rel, "officerTitle") || (/<isOfficer>\s*(1|true)/i.test(rel) ? "Officer" : /<isDirector>\s*(1|true)/i.test(rel) ? "Director" : /<isTenPercentOwner>\s*(1|true)/i.test(rel) ? "10% owner" : "Insider");
  const out: Trade[] = [];
  let line = 0;
  for (const m of xml.matchAll(/<nonDerivativeTransaction>([\s\S]*?)<\/nonDerivativeTransaction>/g)) {
    line++;
    const code = val(m[1], "transactionCode");
    if (code !== "P" && code !== "S") continue;
    const shares = Number(val(m[1], "transactionShares")), price = Number(val(m[1], "transactionPricePerShare"));
    const date = val(m[1], "transactionDate");
    if (!Number.isFinite(shares) || !date) continue;
    out.push({ insider, role, side: code === "P" ? "Buy" : "Sell", shares, price: Number.isFinite(price) && price > 0 ? price : null, date: date.slice(0, 10), filed, url, line });
  }
  return out;
}
