// Screener data (server only): mapped companies with link counts, 1-month change and a 30-day trend from saved daily closes.
// Nothing is estimated: a company with no saved price history has no change and no trend, and is left out as soon as a change filter is set.
import { supabaseServer } from "@/lib/supabase/server";
import { isOffline } from "@/lib/mode";
import { readSnapshot, readMarket, type CoRow } from "@/lib/saved";
import { MARKETS } from "@/lib/graph";
import { groupOf, UNCLASSIFIED } from "@/lib/metrics-core";

export const SEG = ["consumer", "business", "infrastructure"], SIZE = ["large", "mid", "small"];
export type Filters = { segment: string; size: string; market: string; dir: string; scope: string; sort: string; order: string };
export type Row = { c: CoRow; links: number; ch: { pct: number; from: string } | null; spark: number[] | null };

export function parseFilters(q: Record<string, string | undefined>): Filters {
  const pick = (v: string | undefined, ok: readonly string[]) => (v && ok.includes(v) ? v : "");
  const sort = pick(q.sort, ["ret", "links", "name"]) || "ret";
  return {
    // A blank segment or size tier is the "Unclassified" group.
    segment: pick(q.segment, [...SEG, UNCLASSIFIED]), size: pick(q.size, [...SIZE, UNCLASSIFIED]), market: pick(q.market, MARKETS as readonly string[]), dir: pick(q.dir, ["up", "down"]),
    scope: q.scope === "viewed" ? "viewed" : "all", sort, order: q.order === "asc" ? "asc" : q.order === "desc" ? "desc" : sort === "name" ? "asc" : "desc",
  };
}
export const hasFilter = (f: Filters) => !!(f.segment || f.size || f.market || f.dir);

function history(ticker: string): { pct: number; from: string; spark: number[] } | null {
  const d = readMarket(ticker)?.daily;
  if (!d || d.length < 2) return null;
  const last = d[d.length - 1], target = last.t - 30 * 86400;
  const base = [...d].reverse().find((p) => p.t <= target);
  if (!base || base.c === 0) return null;
  return { pct: ((last.c - base.c) / base.c) * 100, from: new Date(base.t * 1000).toISOString().slice(0, 10), spark: d.filter((p) => p.t >= target).map((p) => p.c) };
}

async function linkCounts(ids: number[]): Promise<Map<number, number>> {
  const n = new Map<number, number>();
  const add = (a: number, b: number) => { n.set(a, (n.get(a) ?? 0) + 1); n.set(b, (n.get(b) ?? 0) + 1); };
  if (isOffline()) (readSnapshot()?.rels ?? []).forEach((r) => add(r.source.id, r.target.id));
  else if (ids.length) {
    const supabase = await supabaseServer();
    const { data } = await supabase.from("relationships").select("source_id,target_id").neq("status", "rejected").or(`source_id.in.(${ids.join(",")}),target_id.in.(${ids.join(",")})`).limit(5000);
    (data ?? []).forEach((r: { source_id: number; target_id: number }) => add(r.source_id, r.target_id));
  }
  return n;
}

export async function loadRows(f: Filters): Promise<{ rows: Row[]; total: number; up: number; withData: number }> {
  let cos: CoRow[];
  if (isOffline()) cos = (readSnapshot()?.companies ?? []).filter((c) => c.is_seed && c.ticker);
  else {
    const supabase = await supabaseServer();
    cos = ((await supabase.from("companies").select("id,ticker,name,is_seed,entity_type,segment,size_tier,markets").eq("is_seed", true).not("ticker", "is", null)).data ?? []) as CoRow[];
    if (f.scope === "viewed") {
      const v = new Set(((await supabase.from("viewed_companies").select("company_id")).data ?? []).map((x: { company_id: number }) => x.company_id));
      cos = cos.filter((c) => v.has(c.id));
    }
  }
  const counts = await linkCounts(cos.map((c) => c.id));
  const all = cos.map((c) => { const h = history(c.ticker!); return { c, links: counts.get(c.id) ?? 0, ch: h ? { pct: h.pct, from: h.from } : null, spark: h ? h.spark : null } as Row; });
  const rows = all
    .filter(({ c, ch }) => (!f.segment || groupOf(c.segment) === f.segment) && (!f.size || groupOf(c.size_tier) === f.size) && (!f.market || (c.markets ?? []).includes(f.market)) && (!f.dir || (ch && (f.dir === "up" ? ch.pct >= 0 : ch.pct < 0))))
    .sort((a, b) => {
      const s = f.order === "asc" ? 1 : -1;
      if (f.sort === "name") return s * a.c.name.localeCompare(b.c.name);
      if (f.sort === "links") return s * (a.links - b.links) || a.c.name.localeCompare(b.c.name);
      if (a.ch == null || b.ch == null) return a.ch == null ? (b.ch == null ? a.c.name.localeCompare(b.c.name) : 1) : -1; // no history always last
      return s * (a.ch.pct - b.ch.pct);
    });
  return { rows, total: cos.length, up: rows.filter((r) => r.ch && r.ch.pct >= 0).length, withData: all.filter((r) => r.ch).length };
}

const q = (s: string | number | null) => { const t = s == null ? "" : String(s); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
export function toCsv(rows: Row[]): string {
  const head = ["ticker", "name", "markets", "segment", "size", "links", "change_1m_pct", "change_since"];
  const body = rows.map(({ c, links, ch }) => [c.ticker, c.name, (c.markets ?? []).join("/"), c.segment, c.size_tier, links, ch ? ch.pct.toFixed(2) : "", ch?.from ?? ""].map(q).join(","));
  return [head.join(","), ...body].join("\n") + "\n";
}
