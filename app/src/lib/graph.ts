// Map layout rules (card J1, GRF-1, GRF-2, GRF-4, GRF-5). Pure functions: no data access here.
export type LinkType = "supplies" | "sells_to" | "partners" | "competes" | "invests" | "acquires";
export type Market = "US" | "LSE" | "HKEX";
export const MARKETS: Market[] = ["US", "LSE", "HKEX"];
export const MARKET_LABEL: Record<Market, string> = { US: "US", LSE: "London (LSE)", HKEX: "Hong Kong (HKEX)" };
// markets is empty when the listing is not yet known. A company can list in more than one market.
export type Co = { id: number; ticker: string | null; name: string; is_seed: boolean | null; entity_type: string | null; markets?: string[] | null; exchange?: string | null; country?: string | null };
// Regions (M16). A revenue row names a country; the region comes from the country_region lookup, never typed on the company.
export const REGIONS = ["North America", "Latin America", "Europe", "MENA", "Sub-Saharan Africa", "APAC"] as const;
export type Region = (typeof REGIONS)[number];
export type GeoRow = { company_id: number; country: string | null; label: string; bucket_region: string | null; revenue_pct: number | null; revenue_amount: number | null; currency: string | null; unit: string | null; period_end: string; pct_basis: string; status: string };
export type GeoMap = Record<number, GeoRow[]>;
export type CountryRegion = Record<string, string>;
export const regionOf = (g: GeoRow, cr: CountryRegion): string | null => (g.country ? cr[g.country] ?? null : g.bucket_region);
/** Share of a company's revenue in one region, summed over the rows the report gives. Null when the company has no row in that region or a row has no share. */
export function regionShare(rows: GeoRow[] | undefined, region: string, cr: CountryRegion): number | null {
  const hit = (rows ?? []).filter((g) => regionOf(g, cr) === region);
  if (hit.length === 0 || hit.some((g) => g.revenue_pct == null)) return null;
  return Math.round(hit.reduce((a, g) => a + g.revenue_pct!, 0) * 10) / 10;
}
export const hasRegion = (rows: GeoRow[] | undefined, region: string, cr: CountryRegion) => (rows ?? []).some((g) => regionOf(g, cr) === region);

export type Evidence = { quote: string | null; document_url: string | null; section: string | null; published_at: string | null; quote_found: boolean | null };
export type Rel = {
  id: number; relationship_type: LinkType; source: Co; target: Co;
  exposure_pct: number | null; exposure_basis: string | null; exposure_qualifier: string | null; exposure_as_of: string | null;
  confidence: number | null; trust_status: string | null; source_type: string | null; status: string; as_of_date: string | null; note?: string | null;
  evidence: Evidence[];
};
export type Side = "left" | "right" | "top" | "bottom";
export type MapNode = { co: Co; side: Side; links: Rel[]; score: number };

export const TYPE_LABEL: Record<LinkType, string> = {
  supplies: "supplies", sells_to: "sells to", partners: "partners with", competes: "competes with", invests: "invests in", acquires: "acquired",
};
export const MAX_PER_SIDE = 5;

// Left: links pointing into the focal company. Right: links pointing out. Above: competitors. Below: partners.
export function sideOf(r: Rel, focalId: number): Side {
  if (r.relationship_type === "competes") return "top";
  if (r.relationship_type === "partners") return "bottom";
  return r.target.id === focalId ? "left" : "right";
}

const PRIORITY: Record<Side, number> = { left: 0, right: 0, bottom: 1, top: 2 };

// One node per counterparty. The node sits on the side of its highest-priority link; its other links are drawn to it too.
export function buildNodes(rels: Rel[], focalId: number): MapNode[] {
  const by = new Map<number, MapNode>();
  for (const r of rels) {
    const other = r.source.id === focalId ? r.target : r.source;
    const side = sideOf(r, focalId);
    const score = (r.confidence ?? 0) + Math.min(r.evidence.length, 3) / 10;
    const n = by.get(other.id);
    if (!n) by.set(other.id, { co: other, side, links: [r], score });
    else {
      n.links.push(r);
      n.score = Math.max(n.score, score);
      if (PRIORITY[side] < PRIORITY[n.side]) n.side = side;
    }
  }
  return [...by.values()].sort((a, b) => b.score - a.score || a.co.name.localeCompare(b.co.name));
}

export function shown(nodes: MapNode[], side: Side, expanded: boolean): { visible: MapNode[]; hidden: number } {
  const all = nodes.filter((n) => n.side === side);
  return expanded ? { visible: all, hidden: 0 } : { visible: all.slice(0, MAX_PER_SIDE), hidden: Math.max(0, all.length - MAX_PER_SIDE) };
}

export const SIDES: Side[] = ["left", "right", "top", "bottom"];
export const SIDE_LABEL: Record<Side, string> = { left: "Into the company", right: "Out of the company", top: "Competitors", bottom: "Partners" };

// Paging (J1 follow-up): a side with more than MAX_PER_SIDE companies is shown MAX_PER_SIDE at a time, best-scored first.
// page is clamped, so a stale page number after a filter change still lands on a real batch.
export function pageOf(nodes: MapNode[], side: Side, page: number): { visible: MapNode[]; all: MapNode[]; page: number; pages: number; from: number; to: number; total: number } {
  const all = nodes.filter((n) => n.side === side);
  const pages = Math.max(1, Math.ceil(all.length / MAX_PER_SIDE));
  const p = Math.min(Math.max(0, Math.floor(page) || 0), pages - 1);
  const start = p * MAX_PER_SIDE;
  return { visible: all.slice(start, start + MAX_PER_SIDE), all, page: p, pages, from: all.length ? start + 1 : 0, to: Math.min(all.length, start + MAX_PER_SIDE), total: all.length };
}

export const isMapped = (c: Co) => !!c.is_seed && !!c.ticker;

// Trust badge (UX-4). Rows not yet promoted by the admin carry their own "Staged" tag and never a Verified badge.
export function badgeOf(r: Rel): { label: string; cls: string } {
  if (r.status === "staged") return { label: "Staged, not reviewed", cls: "b-staged" };
  switch (r.trust_status) {
    case "verified": return { label: "Verified", cls: "b-verified" };
    case "curated": return { label: "Curated", cls: "b-curated" };
    case "live_generated": return { label: "Live-generated, not reviewed", cls: "b-live" };
    case "sample": return { label: "Sample data", cls: "b-sample" };
    default: return { label: "Staged, not reviewed", cls: "b-staged" };
  }
}

// Link exposure (GRF-11): only a figure from the source document; never zero, blank or N/A.
export function exposureText(r: Rel): string {
  if (r.exposure_pct == null || !r.exposure_basis || r.exposure_basis === "none") return "Size not disclosed";
  const q = r.exposure_qualifier === "at_least" ? "at least " : r.exposure_qualifier === "approximate" ? "about " : "";
  const of = r.exposure_basis === "source_revenue" ? `of ${r.source.name}'s revenue` : r.exposure_basis === "target_cost" ? `of ${r.target.name}'s costs` : "ownership";
  const per = r.exposure_as_of ? `, ${r.exposure_as_of.slice(0, 4)}` : "";
  return `${q}${r.exposure_pct}% ${of}${per}`;
}

// A unit or brand shown under its parent keeps its own name in brackets: "Amazon (AWS)".
export function viaLabel(n: MapNode): string | null {
  const v = [...new Set(n.links.map((l) => l.note?.startsWith("via ") ? l.note.slice(4) : null))];
  return v.length === 1 && v[0] ? v[0] : null;
}
