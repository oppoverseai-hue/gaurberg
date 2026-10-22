import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { getAccess, supabaseServer } from "@/lib/supabase/server";
import { isOffline } from "@/lib/mode";
import { MARKETS, MARKET_LABEL, type Market } from "@/lib/graph";
import { loadRows, parseFilters, hasFilter, SEG, SIZE, type Filters } from "@/lib/screener";
import FilterBar from "@/components/FilterBar";

export const dynamic = "force-dynamic";

// Screener (TRM-5): mapped companies by market, segment, size and 1-month change, from saved daily closes.
// A company with no saved price history shows "no saved price history" and is left out once a change filter is set. Nothing is estimated.
type Past = { id: number; filters: Partial<Filters>; used_at: string };
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const DIRW: Record<string, string> = { up: "up over 1 month", down: "down over 1 month" };
const label = (f: Partial<Filters>) => [f.market ? MARKET_LABEL[f.market as Market] ?? f.market : "", f.segment ? cap(f.segment) : "", f.size ? `${f.size} size` : "", f.dir ? DIRW[f.dir] : ""].filter(Boolean).join(" · ");
const qs = (o: Record<string, string>) => { const p = new URLSearchParams(Object.entries(o).filter(([, v]) => v)); const s = p.toString(); return s ? "?" + s : ""; };

async function forget(fd: FormData) {
  "use server";
  const id = Number(fd.get("id"));
  if (!Number.isFinite(id)) return;
  const supabase = await supabaseServer();
  await supabase.from("saved_screens").delete().eq("id", id);
  revalidatePath("/screener");
}

function Spark({ v, up }: { v: number[]; up: boolean }) {
  if (v.length < 2) return null;
  const w = 80, h = 22, lo = Math.min(...v), hi = Math.max(...v), r = hi - lo || 1;
  const pts = v.map((y, i) => `${((i / (v.length - 1)) * w).toFixed(1)},${(h - 2 - ((y - lo) / r) * (h - 4)).toFixed(1)}`).join(" ");
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true"><polyline points={pts} fill="none" stroke={up ? "var(--up)" : "var(--down)"} strokeWidth="1.5" strokeLinejoin="round" /></svg>;
}

export default async function Screener({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const access = await getAccess();
  if (access.state !== "ok") redirect("/");
  const f = parseFilters(await searchParams);
  const { rows, total, up, withData } = await loadRows(f);

  let past: Past[] = [];
  if (!isOffline()) {
    const supabase = await supabaseServer();
    if (hasFilter(f)) await supabase.from("saved_screens").upsert({ filters: { segment: f.segment, size: f.size, market: f.market, dir: f.dir }, filters_key: [f.segment, f.size, f.market, f.dir].join("|"), used_at: new Date().toISOString() }, { onConflict: "user_id,filters_key" });
    past = ((await supabase.from("saved_screens").select("id,filters,used_at").order("used_at", { ascending: false }).limit(8)).data ?? []) as Past[];
  }

  const base: Record<string, string> = { segment: f.segment, size: f.size, market: f.market, dir: f.dir, scope: f.scope === "viewed" ? "viewed" : "" };
  const sortHref = (key: string) => {
    const next = f.sort === key ? (f.order === "asc" ? "desc" : "asc") : key === "name" ? "asc" : "desc";
    return "/screener" + qs({ ...base, sort: key, order: next });
  };
  const arrow = (key: string) => (f.sort === key ? (f.order === "asc" ? " ↑" : " ↓") : "");
  const scopeHref = (s: string) => "/screener" + qs({ ...base, scope: s === "viewed" ? "viewed" : "" });
  const exportHref = "/screener/export" + qs({ ...base, sort: f.sort, order: f.order });

  return (
    <main className="narrow scr">
      <div className="scr-head">
        <div>
          <h1>Screener</h1>
          <p className="muted">{rows.length} of {total} mapped companies · {up} up over 1 month · {withData} with saved price history</p>
        </div>
        <a className="btn" href={exportHref}>Export CSV</a>
      </div>

      <div className="scr-bar">
        <div className="scr-scope" role="tablist" aria-label="Scope">
          <Link href={scopeHref("all")} className={f.scope === "all" ? "on" : ""}>All mapped</Link>
          <Link href={scopeHref("viewed")} className={f.scope === "viewed" ? "on" : ""}>Viewed by me</Link>
        </div>
        <FilterBar
          values={{ market: f.market, segment: f.segment, size: f.size, dir: f.dir }}
          markets={MARKETS.map((m) => ({ v: m, l: MARKET_LABEL[m] }))}
          segments={SEG.map((s) => ({ v: s, l: cap(s) }))}
          sizes={SIZE.map((s) => ({ v: s, l: cap(s) }))}
          hidden={{ scope: f.scope === "viewed" ? "viewed" : "", sort: f.sort, order: f.order }}
        />
      </div>

      {past.length > 0 && (
        <div className="scr-past">
          <span className="muted mono">Previous</span>
          {past.map((p) => (
            <span key={p.id} className="chip">
              <Link href={"/screener" + qs(Object.fromEntries(Object.entries(p.filters).filter(([, v]) => v)) as Record<string, string>)}>{label(p.filters)}</Link>
              <form action={forget}><input type="hidden" name="id" value={p.id} /><button aria-label="Forget this screen" title="Forget this screen">×</button></form>
            </span>
          ))}
        </div>
      )}

      <div className="card scr-card">
        {!rows.length ? (
          <p className="muted mono" style={{ fontSize: 12, margin: 12 }}>{f.scope === "viewed" && !hasFilter(f) ? "You have not opened any company yet. Open a company or its map and it will appear here." : "No company matches these filters."}</p>
        ) : (
          <table className="scr-table">
            <thead>
              <tr>
                <th><Link href={sortHref("name")}>Company{arrow("name")}</Link></th>
                <th className="num"><Link href={sortHref("links")}>Links{arrow("links")}</Link></th>
                <th className="num"><Link href={sortHref("ret")}>1M change{arrow("ret")}</Link></th>
                <th>30-day trend</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, links, ch, spark }) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/company/${c.ticker}`} className="scr-name"><strong>{c.name}</strong></Link>
                    <span className="muted mono scr-sub">{c.ticker} · {(c.markets ?? []).join("/") || "n/a"} · {c.segment ?? "n/a"}</span>
                  </td>
                  <td className="num mono">{links}</td>
                  <td className="num mono" style={{ color: ch ? (ch.pct >= 0 ? "var(--up)" : "var(--down)") : "var(--fg2)" }}>
                    {ch ? <>{ch.pct >= 0 ? "+" : ""}{ch.pct.toFixed(1)}%<span className="muted scr-sub">since {ch.from}</span></> : <span className="muted">no saved price history</span>}
                  </td>
                  <td>{spark && ch ? <Spark v={spark} up={ch.pct >= 0} /> : null}</td>
                  <td className="num"><Link href={`/map/${c.ticker}`} className="mono scr-map">Map →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="muted mono" style={{ fontSize: 11 }}>Prices are end-of-day closes from saved data. Companies without saved history are listed last and dropped when a change filter is set.</p>
    </main>
  );
}
