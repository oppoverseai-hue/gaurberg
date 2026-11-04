// Co-movement of linked companies (GRF-19). Pure functions: no data access here.
// From daily closes in price_cache: on the last WINDOW shared trading days, the beta (move of the linked company per 1% move of the
// focal company) and the correlation of simple daily returns. A measured price pattern only: not a disclosed size, not a prediction.
// Fewer than MIN_DAYS shared days gives a stated gap, never a figure.

export const WINDOW = 250;
export const MIN_DAYS = 120;
export const COMOVE_NOTE = "Measured price pattern from daily closes. Not a disclosed size and not a prediction.";

export type Close = { ts: string; close: number };
export type Comove =
  | { ok: true; beta: number; corr: number; days: number; from: string; to: string }
  | { ok: false; days: number; gap: string };

const day = (ts: string) => ts.slice(0, 10);

/** Beta and correlation of `other` on `focal` over their last WINDOW shared trading days. */
export function comove(focal: Close[], other: Close[], window = WINDOW, min = MIN_DAYS): Comove {
  if (!focal.length || !other.length) return { ok: false, days: 0, gap: "No price history saved" };
  const o = new Map(other.filter((c) => c.close > 0).map((c) => [day(c.ts), Number(c.close)]));
  const shared = [...new Map(focal.filter((c) => c.close > 0).map((c) => [day(c.ts), Number(c.close)])).entries()]
    .filter(([d]) => o.has(d)).sort((a, b) => a[0].localeCompare(b[0])).slice(-(window + 1));
  const days = Math.max(0, shared.length - 1); // returns between consecutive shared days
  if (days < min) return { ok: false, days, gap: `Not enough shared price history (${days} of ${min} trading days)` };
  const x: number[] = [], y: number[] = [];
  for (let i = 1; i < shared.length; i++) {
    x.push(shared[i][1] / shared[i - 1][1] - 1);
    y.push(o.get(shared[i][0])! / o.get(shared[i - 1][0])! - 1);
  }
  const mx = x.reduce((a, v) => a + v, 0) / days, my = y.reduce((a, v) => a + v, 0) / days;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < days; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  if (sxx === 0 || syy === 0) return { ok: false, days, gap: "Price did not move in this period" };
  return { ok: true, beta: sxy / sxx, corr: sxy / Math.sqrt(sxx * syy), days, from: shared[0][0], to: shared[shared.length - 1][0] };
}

/** One result per linked company id, each against the focal company. */
export function comoveAll(focalId: number, ids: number[], closes: Record<number, Close[]>): Record<number, Comove> {
  return Object.fromEntries(ids.filter((id) => id !== focalId).map((id) => [id, comove(closes[focalId] ?? [], closes[id] ?? [])]));
}

const period = (c: Extract<Comove, { ok: true }>) => (c.days >= 240 ? "last 12 months" : `last ${c.days} trading days`);

/** "Moves 0.78% per 1% of Uber · correlation 0.58 · last 12 months", or the gap. */
export const comoveText = (c: Comove, focalName: string): string =>
  c.ok ? `Moves ${c.beta.toFixed(2)}% per 1% of ${focalName} · correlation ${c.corr.toFixed(2)} · ${period(c)}` : c.gap;

/** Map line width for "Thicken by co-movement": positive correlation only; a gap or a negative correlation keeps the base width. */
export const comoveWidth = (c: Comove | undefined): number => (c?.ok && c.corr > 0 ? 1.5 + c.corr * 5 : 1.5);
