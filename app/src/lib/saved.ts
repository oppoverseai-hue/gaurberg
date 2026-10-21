// Saved data (server only): the graph snapshot and per-company market data files in app/data.
import fs from "node:fs";
import path from "node:path";
import type { Co, Rel } from "@/lib/graph";

export type Pt = { t: number; c: number };
export type SavedQuote = { price: number; change: number; changePct: number; high: number; low: number; open: number; prevClose: number; t: number | null };
export type SavedFund = Partial<Record<"marketCap" | "pe" | "beta" | "high52" | "low52" | "shares" | "eps" | "avgVolume" | "revGrowth" | "grossMargin" | "opMargin" | "netMargin" | "revPerShare" | "currentRatio" | "debtEquity", number | null>>;
export type SavedProfile = { exchange?: string | null; industry?: string | null; website?: string | null; employees?: number | null; description?: string | null };
export type SavedMarket = {
  saved_at: string; source: string; // "finnhub+twelvedata" or "manual"
  quote?: SavedQuote | null; daily?: Pt[] | null; weekly?: Pt[] | null;
  fundamentals?: SavedFund | null; profile?: SavedProfile | null; nextEarnings?: string | null;
};
export type CoRow = Co & { segment: string | null; size_tier: string | null };
export type Snapshot = { generated_at: string; companies: CoRow[]; rels: Rel[] };

const dir = () => path.join(process.cwd(), "data");
let snap: Snapshot | null | undefined;

export function readSnapshot(): Snapshot | null {
  if (snap !== undefined) return snap;
  try {
    // The file stores links by company id; join them back into the same shape the database returns.
    const raw = JSON.parse(fs.readFileSync(path.join(dir(), "snapshot.json"), "utf8")) as { generated_at: string; companies: CoRow[]; rels: (Omit<Rel, "source" | "target"> & { source_id: number; target_id: number })[] };
    const by = new Map(raw.companies.map((c) => [c.id, c]));
    const rels = raw.rels.flatMap(({ source_id, target_id, ...r }) => { const source = by.get(source_id), target = by.get(target_id); return source && target ? [{ ...r, source, target } as Rel] : []; });
    snap = { generated_at: raw.generated_at, companies: raw.companies, rels };
  } catch { snap = null; }
  return snap;
}

export function readMarket(ticker: string): SavedMarket | null {
  if (!/^[A-Z0-9.\-]{1,10}$/.test(ticker)) return null;
  try { return JSON.parse(fs.readFileSync(path.join(dir(), "market", `${ticker}.json`), "utf8")) as SavedMarket; } catch { return null; }
}
