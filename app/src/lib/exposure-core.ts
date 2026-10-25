// Exposure view rules (GRF-17, on the GRF-11 exposure rules). Pure functions: no data access here.
// "If X is hit": every promoted link touching X, one row per link, the other company being the exposed one.
// A stored percentage is a weight only when it is the exposed company's own share and a saved quote contains the figure.
// Weights are ranked only within one kind of share; they are never converted, estimated or back-filled.
import type { Co, Evidence, Rel } from "./graph";

export type Kind = "source_revenue" | "target_cost" | "ownership";
export const KINDS: Kind[] = ["source_revenue", "target_cost", "ownership"];
export const KIND_LABEL: Record<Kind, string> = { source_revenue: "Seller's revenue", target_cost: "Buyer's costs", ownership: "Ownership" };

export const NOT_DISCLOSED = "Size not disclosed";
export const NO_SIZE = "No size applies to this kind of link";
export const NOT_IN_QUOTE = "stated figure not found in the saved quote";
export const EMPTY = "No documented exposure in our sources.";
export const GROUP = { unweighted: "No stated weight", partners: "partner (link strength not stated)", competitors: "competitors (effect can be positive or negative)" } as const;

export type Context = { text: string; quote?: Evidence };
export type ExpRow = {
  rel: Rel; co: Co; // co: the exposed company (the other end of the link)
  kind: Kind | null; kindLabel: string;
  weight: number | null; // set only for a ranked row
  text: string; // GRF-11 sentence for a ranked row, otherwise NOT_DISCLOSED or NO_SIZE
  context: Context[]; flag: string | null;
};
export type Exposure = { ranked: Record<Kind, ExpRow[]>; unweighted: ExpRow[]; partners: ExpRow[]; competitors: ExpRow[]; empty: boolean };

const isKind = (b: string | null): b is Kind => b === "source_revenue" || b === "target_cost" || b === "ownership";
const otherOf = (r: Rel, id: number) => (r.source.id === id ? r.target : r.source);

// Numbers compared as written, ignoring trailing zeros after the point on both sides: 6.5 matches "6.50%", 51 matches "51.0".
const norm = (s: string) => (s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s);
const NUM = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;
const WHOLE = /wholly[-‐‑ ]owned|all of the outstanding shares/i;

/** True when one of the quotes states the figure. "wholly-owned" and "all of the outstanding shares" state 100%. */
export function figureInQuote(pct: number, quotes: (string | null)[]): boolean {
  const want = norm(String(pct));
  return quotes.some((q) => !!q && ((q.match(NUM) ?? []).some((t) => norm(t) === want) || (pct === 100 && WHOLE.test(q))));
}
const quoted = (r: Rel) => r.exposure_pct != null && figureInQuote(r.exposure_pct, r.evidence.map((e) => e.quote));

/** The company whose share the stored figure is (GRF-11): the seller's revenue, the buyer's costs, the investor's holding. */
export const shareOwner = (r: Rel): Co | null => (r.exposure_basis === "target_cost" ? r.target : isKind(r.exposure_basis) ? r.source : null);

/** GRF-11 wording for a stored figure, with its qualifier ("about", "at least"). */
export function shareSentence(r: Rel): string | null {
  if (r.exposure_pct == null || !isKind(r.exposure_basis)) return null;
  const pct = `${r.exposure_qualifier === "at_least" ? "at least " : r.exposure_qualifier === "approximate" ? "about " : ""}${r.exposure_pct}%`;
  const year = r.exposure_as_of ? `fiscal ${r.exposure_as_of.slice(0, 4)}` : "fiscal year not given";
  if (r.exposure_basis === "source_revenue") return `${r.target.name} is ${pct} of ${r.source.name}'s revenue (${year})`;
  if (r.exposure_basis === "target_cost") return `${r.source.name} is ${pct} of ${r.target.name}'s costs (${year})`;
  return `${r.source.name} holds ${pct} of ${r.target.name} (as of ${r.exposure_as_of ?? "date not given"})`;
}

/** A figure usable for scale anywhere (map line width): stored with a kind of share and found in a saved quote. */
export const realWeight = (r: Rel): number | null => (isKind(r.exposure_basis) && quoted(r) ? r.exposure_pct : null);

/** The weight of a link for the company exposed when `hitId` is hit: only that company's own share. */
export const exposureWeight = (r: Rel, hitId: number): number | null => (shareOwner(r)?.id === otherOf(r, hitId).id ? realWeight(r) : null);

// A saved quote that states a percentage of revenue, income, sales, profit or costs, on a link with no stored figure
// (Bytes: "68% of the Group's GII"). Shown word for word as context; never stored or ranked as a weight.
const MONEY = /revenue|income|\bGII\b|\bGP\b|sales|profit|costs?\b|purchases|spend/i;
const quoteContext = (r: Rel): Context[] =>
  r.exposure_pct != null ? [] : r.evidence.filter((e) => e.quote && /\d\s?%|\bper ?cent\b/i.test(e.quote) && MONEY.test(e.quote)).map((e) => ({ text: "Stated in the source, not a stored weight", quote: e }));

function row(r: Rel, hitId: number): ExpRow {
  const co = otherOf(r, hitId);
  const t = r.relationship_type;
  if (t === "competes" || t === "partners") return { rel: r, co, kind: null, kindLabel: "None", weight: null, text: NO_SIZE, context: t === "partners" ? quoteContext(r) : [], flag: null };
  const kind = isKind(r.exposure_basis) && r.exposure_pct != null ? r.exposure_basis : null;
  const base = { rel: r, co, kind, kindLabel: kind ? KIND_LABEL[kind] : "Kind of share not stated", weight: null, text: NOT_DISCLOSED, context: quoteContext(r), flag: null };
  if (!kind) return base;
  if (!quoted(r)) return { ...base, flag: NOT_IN_QUOTE };
  const owner = shareOwner(r)!;
  if (owner.id !== co.id) return { ...base, context: [{ text: `${shareSentence(r)}. This is ${owner.name}'s share, not ${co.name}'s.` }] };
  return { ...base, weight: r.exposure_pct, text: shareSentence(r)! };
}

const byName = (a: ExpRow, b: ExpRow) => a.co.name.localeCompare(b.co.name) || a.rel.id - b.rel.id;

export function buildExposure(hitId: number, rels: Rel[]): Exposure {
  const rows = rels.filter((r) => (r.source.id === hitId) !== (r.target.id === hitId)).map((r) => row(r, hitId));
  const ranked = Object.fromEntries(KINDS.map((k) => [k, rows.filter((x) => x.weight != null && x.kind === k).sort((a, b) => b.weight! - a.weight! || byName(a, b))])) as Record<Kind, ExpRow[]>;
  const directed = rows.filter((x) => x.rel.relationship_type !== "competes" && x.rel.relationship_type !== "partners");
  const unweighted = directed.filter((x) => x.weight == null).sort((a, b) => a.kindLabel.localeCompare(b.kindLabel) || byName(a, b));
  return {
    ranked, unweighted,
    partners: rows.filter((x) => x.rel.relationship_type === "partners").sort(byName),
    competitors: rows.filter((x) => x.rel.relationship_type === "competes").sort(byName),
    empty: directed.length === 0,
  };
}

