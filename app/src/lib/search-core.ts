// Search over every company in the graph (TRM-1). Pure functions: no data access here.
// One index of names, tickers and aliases (about 500 rows) is built once and matched in memory, so typing never queries the database.
// Mapped companies open their page. A counterparty that is not mapped opens the map of the mapped company it is most linked to,
// with its panel open (?focus=<id>), instead of a live lookup. Groups ("Riders") are not companies and are left out (GRF-1),
// and so are the live-lookup test rows (isTestLookup in graph.ts, UX-4).
// A company with no ticker and no link to a mapped company has nowhere to open, so it is left out too.
import { isTestLookup } from "./graph.ts";

export type IndexCo = { id: number; ticker: string | null; name: string; is_seed: boolean | null; entity_type: string | null; aliases?: string[] | null; markets?: string[] | null };
export type IndexLink = { source_id: number; target_id: number };
export type Entry = {
  id: number; name: string; ticker: string | null; aliases: string[]; markets: string[];
  mapped: boolean; links: number;
  context: { ticker: string; name: string } | null; // for an unmapped company: the mapped company whose map shows it
  contexts: number; // how many mapped companies it is linked to
};
export type Hit = Entry & { alias: string | null; href: string; mapHref: string };

const isGroup = (c: IndexCo) => c.entity_type === "segment_group"; // same rule as isGroup in graph.ts (pure modules share types only)

/** Lower case, accents dropped, anything that is not a letter or digit becomes a space: "Oslo Børs" -> "oslo bors". */
export const norm = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ø/gi, "o").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function buildIndex(cos: IndexCo[], links: IndexLink[]): Entry[] {
  const byId = new Map(cos.map((c) => [c.id, c]));
  const mapped = (c: IndexCo | undefined) => !!c && !!c.is_seed && !!c.ticker && !isGroup(c);
  const count = new Map<number, number>();
  const toMapped = new Map<number, Map<number, number>>(); // company -> mapped neighbour -> links
  for (const l of links) {
    for (const [a, b] of [[l.source_id, l.target_id], [l.target_id, l.source_id]]) {
      count.set(a, (count.get(a) ?? 0) + 1);
      if (mapped(byId.get(b))) { const m = toMapped.get(a) ?? new Map<number, number>(); m.set(b, (m.get(b) ?? 0) + 1); toMapped.set(a, m); }
    }
  }
  const out: Entry[] = [];
  for (const c of cos) {
    if (isGroup(c) || isTestLookup(c)) continue;
    const isMapped = mapped(c);
    const ns = [...(toMapped.get(c.id) ?? new Map()).entries()].map(([id, n]) => ({ co: byId.get(id)!, n }))
      .sort((a, b) => b.n - a.n || a.co.name.localeCompare(b.co.name));
    const context = !isMapped && ns.length ? { ticker: ns[0].co.ticker!, name: ns[0].co.name } : null;
    if (!isMapped && !context && !c.ticker) continue;
    out.push({ id: c.id, name: c.name, ticker: c.ticker, aliases: c.aliases ?? [], markets: c.markets ?? [], mapped: isMapped, links: count.get(c.id) ?? 0, context, contexts: ns.length });
  }
  return out;
}

export const hrefOf = (e: Entry): { href: string; mapHref: string } =>
  e.mapped || !e.context
    ? { href: `/company/${e.ticker}`, mapHref: `/company/${e.ticker}/map` }
    : { href: `/company/${e.context.ticker}/map?focus=${e.id}`, mapHref: `/company/${e.context.ticker}/map?focus=${e.id}` };

// Match tiers, best first. Word and substring matches need 2 and 3 characters, so one letter does not match half the graph.
function tier(e: Entry, q: string, n: string): { t: number; alias: string | null } | null {
  const tk = (e.ticker ?? "").toLowerCase(), base = tk.split(".")[0];
  const name = norm(e.name), al = e.aliases.map((a) => ({ a, n: norm(a) }));
  if (tk && (tk === q || base === q)) return { t: 0, alias: null };
  if (name === n) return { t: 1, alias: null };
  const ax = al.find((x) => x.n === n); if (ax) return { t: 1, alias: ax.a };
  if (tk && (tk.startsWith(q) || base.startsWith(q))) return { t: 2, alias: null };
  if (name.startsWith(n)) return { t: 3, alias: null };
  const ap = al.find((x) => x.n.startsWith(n)); if (ap) return { t: 4, alias: ap.a };
  if (n.length >= 2) {
    if (name.split(" ").some((w) => w.startsWith(n))) return { t: 5, alias: null };
    const aw = al.find((x) => x.n.split(" ").some((w) => w.startsWith(n))); if (aw) return { t: 5, alias: aw.a };
  }
  if (n.length >= 3) {
    if (name.includes(n)) return { t: 6, alias: null };
    const as = al.find((x) => x.n.includes(n)); if (as) return { t: 6, alias: as.a };
  }
  return null;
}

/** The best matches for what was typed. Mapped companies first within a tier, then the better connected. */
export function search(index: Entry[], q: string, limit = 8): Hit[] {
  const raw = q.trim().toLowerCase(), n = norm(q);
  if (!n) return [];
  const hits: { e: Entry; t: number; alias: string | null }[] = [];
  for (const e of index) { const m = tier(e, raw, n); if (m) hits.push({ e, ...m }); }
  hits.sort((a, b) => a.t - b.t || Number(b.e.mapped) - Number(a.e.mapped) || b.e.links - a.e.links || a.e.name.localeCompare(b.e.name));
  return hits.slice(0, limit).map(({ e, alias }) => ({ ...e, alias, ...hrefOf(e) }));
}

/** Before anything is typed: the best-connected mapped companies. */
export const top = (index: Entry[], limit = 3): Hit[] =>
  index.filter((e) => e.mapped).sort((a, b) => b.links - a.links || a.name.localeCompare(b.name)).slice(0, limit).map((e) => ({ ...e, alias: null, ...hrefOf(e) }));

/** One clear pick for the command bar: an exact ticker, or a single exact name or alias, or the only match. Otherwise null. */
export function pick(index: Entry[], q: string): Hit | null {
  const hits = search(index, q, 50);
  const exact = hits.filter((h) => { const tk = (h.ticker ?? "").toLowerCase(); return tk === q.trim().toLowerCase(); });
  if (exact.length === 1) return exact[0];
  const named = hits.filter((h) => norm(h.name) === norm(q) || (h.alias && norm(h.alias) === norm(q)));
  if (named.length === 1) return named[0];
  return hits.length === 1 ? hits[0] : null;
}
