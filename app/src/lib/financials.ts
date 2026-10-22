// Standardized statements saved from SEC EDGAR by app/scripts/save-financials.mjs (server only).
import fs from "node:fs";
import path from "node:path";

export type FinRow = { label: string; values: (number | null)[]; fmt: "usd" | "eps" | "pct"; subs?: FinRow[] };
export type Financials = {
  ticker: string; source: string; saved_at: string; units: string;
  status: "ok" | "no_filer" | "no_10k" | "error"; note?: string;
  columns?: { label: string; end: string; kind: "FY" | "LTM" }[];
  is?: FinRow[]; bs?: FinRow[]; cf?: FinRow[];
  flags?: string[];
  segments?: { measure: string; columns: string[]; rows: FinRow[]; note: string } | null;
};

export function readFinancials(ticker: string): Financials | null {
  try { return JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "financials", `${ticker}.json`), "utf8")) as Financials; } catch { return null; }
}
