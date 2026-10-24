// Connection finder rules (GRF-16). Pure functions: no data access here.
// Direct links between the two companies come first. Only when there are none, paths of two hops through one shared
// counterparty are returned ("indirect (via X)"). Callers pass promoted links only.
import type { Co, Rel } from "./graph";

export type Path = { via: Co; first: Rel[]; second: Rel[] };
export type Connection = { direct: Rel[]; paths: Path[] };

const otherOf = (r: Rel, id: number) => (r.source.id === id ? r.target : r.source);
const touches = (r: Rel, id: number) => r.source.id === id || r.target.id === id;
const weight = (rs: Rel[]) => Math.max(...rs.map((r) => r.evidence.length));

export function findConnection(aId: number, bId: number, rels: Rel[]): Connection {
  if (aId === bId) return { direct: [], paths: [] };
  const direct = rels.filter((r) => touches(r, aId) && touches(r, bId));
  if (direct.length) return { direct, paths: [] };
  const byA = new Map<number, { co: Co; rels: Rel[] }>(), byB = new Map<number, { co: Co; rels: Rel[] }>();
  for (const r of rels) {
    for (const [id, m] of [[aId, byA], [bId, byB]] as const) {
      if (!touches(r, id)) continue;
      const o = otherOf(r, id);
      if (o.id === aId || o.id === bId) continue;
      const e = m.get(o.id) ?? { co: o, rels: [] };
      e.rels.push(r);
      m.set(o.id, e);
    }
  }
  const paths: Path[] = [];
  for (const [id, a] of byA) {
    const b = byB.get(id);
    if (b) paths.push({ via: a.co, first: a.rels, second: b.rels });
  }
  // Best-documented paths first: the weaker hop decides, then the name.
  paths.sort((x, y) => Math.min(weight(y.first), weight(y.second)) - Math.min(weight(x.first), weight(x.second)) || x.via.name.localeCompare(y.via.name));
  return { direct: [], paths };
}

// One sentence per link, in the link's own direction: "Uber Technologies invests in WeRide".
export const SOURCE_LABEL: Record<string, string> = {
  sec_filing: "SEC filing", annual_report: "Annual report", press_release: "Press release", news: "News", manual: "Entered by hand", dummy: "Sample",
};
export const sourceLabel = (r: Rel) => (r.source_type ? SOURCE_LABEL[r.source_type] ?? r.source_type : "Source not recorded");
