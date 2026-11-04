// Exposure view rules (GRF-17, on the GRF-11 exposure rules). Pure functions: no data access here.
// "If X is hit": every promoted link touching X, one row per company, the other company being the exposed one. A company's row
// carries all its links. Its group comes from groupOf in graph.ts, the same rule as the map, so the counts match the map.
// A stored percentage is a weight only when it is the exposed company's own share and a saved quote contains the figure.
// Weights are ranked only within one kind of share; they are never converted, estimated or back-filled.
import { groupOf, type Co, type Evidence, type Rel, type Side } from "./graph.ts";

export type Kind = "source_revenue" | "target_cost" | "ownership";
export const KINDS: Kind[] = ["source_revenue", "target_cost", "ownership"];
export const KIND_LABEL: Record<Kind, string> = { source_revenue: "Seller's revenue", target_cost: "Buyer's costs", ownership: "Ownership" };

export const NOT_DISCLOSED = "Size not disclosed";
export const NO_SIZE = "No size applies to this kind of link";
export const NOT_IN_QUOTE = "stated figure not found in the saved quote";
export const EMPTY = "No documented exposure in our sources.";
export const GROUP = { unweighted: "No stated weight", partners: "partner (link strength not stated)", competitors: "competitors (effect can be positive or negative)" } as const;

export type Context = { text: string; quote?: Evidence };
/** One link, read for the company exposed when X is hit. */
export type ExpLink = {
  rel: Rel; co: Co; // co: the exposed company (the other end of the link)
  kind: Kind | null; kindLabel: string;
  weight: number | null; // set only when the link ranks
  text: string; // GRF-11 sentence for a ranked link, otherwise NOT_DISCLOSED or NO_SIZE
  context: Context[]; flag: string | null;
};
/** One company: its lead link's fields (the ranked figure, or the most informative link), plus every link and its map group. */
export type ExpRow = ExpLink & { links: ExpLink[]; place: Side };
export type Exposure = {
  ranked: Record<Kind, ExpRow[]>; unweighted: ExpRow[]; partners: ExpRow[]; competitors: ExpRow[]; empty: boolean;
  // Companies that compete with (or partner) X but sit in another group because of their other links, as on the map.
  alsoCompete: number; alsoPartner: number;
};

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

function linkRow(r: Rel, hitId: number): ExpLink {
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

const byName = (a: ExpRow, b: ExpRow) => a.co.name.localeCompare(b.co.name) || a.co.id - b.co.id;
const undirected = (x: ExpLink) => x.rel.relationship_type === "competes" || x.rel.relationship_type === "partners";
// Lead link: the highest ranked figure; else a directed link, one with a kind of share or context first; else a partnership.
const leadRank = (x: ExpLink) => (x.weight != null ? 0 : !undirected(x) ? (x.kind || x.context.length ? 1 : 2) : x.rel.relationship_type === "partners" ? 3 : 4);
const byLead = (a: ExpLink, b: ExpLink) => leadRank(a) - leadRank(b) || (b.weight ?? 0) - (a.weight ?? 0) || a.rel.id - b.rel.id;

export function buildExposure(hitId: number, rels: Rel[]): Exposure {
  const by = new Map<number, ExpLink[]>();
  for (const r of rels) {
    if ((r.source.id === hitId) === (r.target.id === hitId)) continue; // a link must have X at exactly one end
    const x = linkRow(r, hitId);
    (by.get(x.co.id) ?? by.set(x.co.id, []).get(x.co.id)!).push(x);
  }
  const rows: ExpRow[] = [...by.values()].map((links) => {
    const sorted = [...links].sort(byLead);
    return { ...sorted[0], links: sorted, place: groupOf(links.map((x) => x.rel), hitId) };
  });
  const directed = rows.filter((x) => x.place !== "top" && x.place !== "bottom");
  const ranked = Object.fromEntries(KINDS.map((k) => [k, directed.filter((x) => x.weight != null && x.kind === k).sort((a, b) => b.weight! - a.weight! || byName(a, b))])) as Record<Kind, ExpRow[]>;
  const has = (x: ExpRow, t: string) => x.links.some((l) => l.rel.relationship_type === t);
  return {
    ranked,
    unweighted: directed.filter((x) => x.weight == null).sort((a, b) => a.kindLabel.localeCompare(b.kindLabel) || byName(a, b)),
    partners: rows.filter((x) => x.place === "bottom").sort(byName),
    competitors: rows.filter((x) => x.place === "top").sort(byName),
    empty: directed.length === 0,
    alsoCompete: rows.filter((x) => x.place !== "top" && has(x, "competes")).length,
    alsoPartner: rows.filter((x) => x.place !== "bottom" && has(x, "partners")).length,
  };
}

