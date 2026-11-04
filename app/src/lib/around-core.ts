// "Around this company" (GRF-18): what is happening to the companies linked to the one on screen. Pure functions, no data
// access, so tests can run them. Every item is a stored fact (a report date, a close) about a company the filings link to
// the focal one; nothing here says the news or move caused anything.
import type { Co, Rel } from "./graph";

export type Role = "competitor" | "partner" | "supplier" | "customer" | "investor" | "stake held" | "acquirer" | "acquired";

/** What the other company is to the focal one, read from one link in its own direction. */
export function roleOf(r: Rel, focalId: number): Role {
  const out = r.source.id === focalId; // focal company is the subject of the sentence
  switch (r.relationship_type) {
    case "competes": return "competitor";
    case "partners": return "partner";
    case "supplies": return out ? "customer" : "supplier";
    case "sells_to": return out ? "customer" : "supplier";
    case "invests": return out ? "stake held" : "investor";
    case "acquires": return out ? "acquired" : "acquirer";
  }
}

export type Neighbour = { co: Co; roles: Role[] };

/** One entry per linked company with every role it plays, in a stable order. */
export function neighbours(rels: Rel[], focalId: number): Neighbour[] {
  const ORDER: Role[] = ["supplier", "customer", "partner", "competitor", "stake held", "investor", "acquired", "acquirer"];
  const by = new Map<number, Neighbour>();
  for (const r of rels) {
    const other = r.source.id === focalId ? r.target : r.source;
    if (other.id === focalId) continue;
    const n = by.get(other.id) ?? { co: other, roles: [] };
    const role = roleOf(r, focalId);
    if (!n.roles.includes(role)) n.roles.push(role);
    by.set(other.id, n);
  }
  return [...by.values()].map((n) => ({ ...n, roles: n.roles.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)) }));
}

export type Report = { co: Co; roles: Role[]; date: string; detail: string | null; when: "today" | "upcoming" | "reported" };
export type Move = { co: Co; roles: Role[]; pct: number; date: string };

export const MOVE_MIN_PCT = 4; // a move at least this large at the last close is listed
export const AHEAD_DAYS = 14, BEHIND_DAYS = 7;

const days = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);

/** Report dates of linked companies from BEHIND_DAYS ago to AHEAD_DAYS ahead, soonest first; past ones are "reported". */
export function reports(ns: Neighbour[], events: { company_id: number; event_date: string; detail: string | null }[], today: string): Report[] {
  const by = new Map(ns.map((n) => [n.co.id, n]));
  const seen = new Set<string>();
  const out: Report[] = [];
  for (const e of events) {
    const n = by.get(e.company_id);
    if (!n) continue;
    const d = days(today, e.event_date);
    if (d < -BEHIND_DAYS || d > AHEAD_DAYS) continue;
    const k = `${e.company_id}|${e.event_date}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ co: n.co, roles: n.roles, date: e.event_date, detail: e.detail, when: d === 0 ? "today" : d > 0 ? "upcoming" : "reported" });
  }
  const rank = { today: 0, upcoming: 1, reported: 2 } as const;
  return out.sort((a, b) => rank[a.when] - rank[b.when] || (a.when === "reported" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));
}

/** Linked companies whose last close moved at least MOVE_MIN_PCT from the close before, biggest first. */
export function moves(ns: Neighbour[], closes: { company_id: number; ts: string; close: number }[], max = 4): Move[] {
  const by = new Map<number, { ts: string; close: number }[]>();
  for (const c of closes) (by.get(c.company_id) ?? by.set(c.company_id, []).get(c.company_id)!).push({ ts: c.ts, close: Number(c.close) });
  const out: Move[] = [];
  for (const n of ns) {
    const s = (by.get(n.co.id) ?? []).sort((a, b) => a.ts.localeCompare(b.ts));
    if (s.length < 2) continue;
    const [prev, last] = s.slice(-2);
    if (!(prev.close > 0)) continue;
    if (days(prev.ts.slice(0, 10), last.ts.slice(0, 10)) > 4) continue; // a gap in stored closes is not a one-day move
    const pct = ((last.close - prev.close) / prev.close) * 100;
    if (Math.abs(pct) >= MOVE_MIN_PCT) out.push({ co: n.co, roles: n.roles, pct, date: last.ts.slice(0, 10) });
  }
  return out.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct)).slice(0, max);
}
