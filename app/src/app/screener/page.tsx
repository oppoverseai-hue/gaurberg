import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { getAccess, supabaseServer } from "@/lib/supabase/server";
import { isOffline } from "@/lib/mode";
import { MARKETS, MARKET_LABEL, type Market } from "@/lib/graph";
import { loadRows, parseFilters, hasFilter, SEG, SIZE, type Filters } from "@/lib/screener";
import FilterBar from "@/components/FilterBar";
import CompsTable from "@/components/CompsTable";
import { loadComps } from "@/lib/comps";
import { arrange, parsePins, SORT_KEYS, type SortKey } from "@/lib/comps-core";
import { dayLabel, UNCLASSIFIED } from "@/lib/metrics-core";
import { REGIONS } from "@/lib/graph";

export const dynamic = "force-dynamic";

// Screener (TRM-5): mapped companies by market, segment, size and 1-month change, from saved daily closes.
// A company with no saved price history shows "no saved price history" and is left out once a change filter is set. Nothing is estimated.
// view=comps (TRM-12): the same companies with stored Finnhub metrics, analyst counts and next earnings; filters add region; pin up to 5.
type Past = { id: number; filters: Partial<Filters>; used_at: string };
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const DIRW: Record<string, string> = { up: "up over 1 month", down: "down over 1 month" };
const label = (f: Partial<Filters>) => [f.market ? MARKET_LABEL[f.market as Market] ?? f.market : "", f.segment ? cap(f.segment) : "", f.size ? `${f.size} size` : "", f.dir ? DIRW[f.dir] : ""].filter(Boolean).join(" · ");
const segOpts = [...SEG.map((s) => ({ v: s, l: cap(s) })), { v: UNCLASSIFIED, l: "Unclassified" }];
const sizeOpts = [...SIZE.map((s) => ({ v: s, l: cap(s) })), { v: UNCLASSIFIED, l: "Unclassified" }];
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
  const w = 200, h = 34, lo = Math.min(...v), hi = Math.max(...v), r = hi - lo || 1;
  const P = v.map((y, i) => [(i / (v.length - 1)) * w, h - 3 - ((y - lo) / r) * (h - 6)] as const);
  // Smooth line: Catmull-Rom converted to cubic curves.
  let d = `M${P[0][0].toFixed(1)},${P[0][1].toFixed(1)}`;
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[i - 1] ?? P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] ?? p2;
    d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="scr-spark"><path d={d} fill="none" stroke={up ? "var(--up)" : "var(--down)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export default async function Screener({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const access = await getAccess();
  if (access.state !== "ok") redirect("/");
  const sp = await searchParams;
  const f = parseFilters(sp);
  const view = sp.view === "comps" ? "comps" : "price";
  const region = view === "comps" && (REGIONS as readonly string[]).includes(sp.region ?? "") ? sp.region! : "";
  if (view === "comps") return <Comps f={f} region={region} sp={sp} />;
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
        <a className="btn scr-export" href={exportHref}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" /></svg>Export CSV</a>
      </div>

      <div className="scr-bar">
        <div className="scr-scope" role="tablist" aria-label="Scope">
          <Link href={scopeHref("all")} className={f.scope === "all" ? "on" : ""}>All mapped</Link>
          <Link href={scopeHref("viewed")} className={f.scope === "viewed" ? "on" : ""}>Viewed by me</Link>
        </div>
        <ViewTabs view="price" scope={f.scope} />
        <FilterBar
          values={{ market: f.market, segment: f.segment, size: f.size, dir: f.dir }}
          markets={MARKETS.map((m) => ({ v: m, l: MARKET_LABEL[m] }))}
          segments={segOpts}
          sizes={sizeOpts}
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
                <th className="scr-trend">30-day trend</th>
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
                  <td className="scr-trend">{spark && ch ? <Spark v={spark} up={ch.pct >= 0} /> : null}</td>
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

function ViewTabs({ view, scope }: { view: "price" | "comps"; scope: string }) {
  const sc: Record<string, string> = scope === "viewed" ? { scope: "viewed" } : {};
  return (
    <div className="scr-scope" role="tablist" aria-label="View">
      <Link href={"/screener" + qs(sc)} className={view === "price" ? "on" : ""}>Price</Link>
      <Link href={"/screener" + qs({ ...sc, view: "comps" })} className={view === "comps" ? "on" : ""}>Comps</Link>
    </div>
  );
}

// Peer comps view (TRM-12). Reads only; unlike the price view it does not save the screen.
async function Comps({ f, region, sp }: { f: Filters; region: string; sp: Record<string, string | undefined> }) {
  const data = await loadComps(f.scope === "viewed" ? "viewed" : "all");
  const sort: SortKey = (SORT_KEYS as readonly string[]).includes(sp.sort ?? "") ? (sp.sort as SortKey) : "name";
  const order = sp.order === "desc" ? "desc" : sp.order === "asc" ? "asc" : sort === "name" || sort === "next" ? "asc" : "desc";
  const pins = parsePins(sp.pin);
  const filters = { segment: f.segment, size: f.size, market: f.market, region };
  const { pinned, rest } = arrange(data.rows, filters, pins, sort, order);
  const base: Record<string, string> = { view: "comps", scope: f.scope === "viewed" ? "viewed" : "", segment: f.segment, size: f.size, market: f.market, region, sort, order, pin: pins.join(",") };
  const href = (o: { sort?: string; order?: string; pin?: string }) => "/screener" + qs({ ...base, ...o });
  const scopeHref = (s: string) => "/screener" + qs({ ...base, scope: s === "viewed" ? "viewed" : "" });
  const asOf = data.asOf.length ? data.asOf.map(dayLabel).join(", ") : null;
  return (
    <main className="narrow scr">
      <div className="scr-head">
        <div>
          <h1>Screener</h1>
          <p className="muted">{pinned.length + rest.length} of {data.rows.length} mapped companies · {data.loaded} with stored metrics{data.staged ? ` (${data.staged} staged, visible to the admin only)` : ""}</p>
        </div>
      </div>
      <div className="scr-bar">
        <div className="scr-scope" role="tablist" aria-label="Scope">
          <Link href={scopeHref("all")} className={f.scope === "all" ? "on" : ""}>All mapped</Link>
          <Link href={scopeHref("viewed")} className={f.scope === "viewed" ? "on" : ""}>Viewed by me</Link>
        </div>
        <ViewTabs view="comps" scope={f.scope} />
        <FilterBar
          values={{ market: f.market, segment: f.segment, size: f.size, region }}
          markets={MARKETS.map((m) => ({ v: m, l: MARKET_LABEL[m] }))}
          regions={REGIONS.map((g) => ({ v: g, l: g }))}
          segments={segOpts}
          sizes={sizeOpts}
          showDir={false}
          hidden={{ view: "comps", scope: f.scope === "viewed" ? "viewed" : "", sort, order, pin: pins.join(",") }}
        />
      </div>
      {pins.length > 0 && (
        <div className="scr-past">
          <span className="muted mono">Compare with</span>
          {pins.map((t) => <span key={t} className="chip"><Link href={`/company/${t}`}>{t}</Link><Link href={href({ pin: pins.filter((p) => p !== t).join(",") })} aria-label={`Unpin ${t}`} title="Unpin">×</Link></span>)}
          <Link href={href({ pin: "" })} className="mono scr-reset">Clear</Link>
        </div>
      )}
      {(data.offline || data.loaded === 0 || data.error) && (
        <p className="savedbar">{data.offline ? "Offline: stored market metrics are not saved for the offline demo. Every cell reads Not loaded." : data.error ? "Could not load stored market metrics. Every cell reads Not loaded; try again." : "Market metrics are not loaded yet: nothing has been reviewed and published. Every cell reads Not loaded."}</p>
      )}
      <div className="card scr-card">
        {!pinned.length && !rest.length ? (
          <p className="muted mono" style={{ fontSize: 12, margin: 12 }}>{f.scope === "viewed" ? "You have not opened any company yet, or none matches these filters." : "No company matches these filters."}</p>
        ) : (
          <CompsTable pinned={pinned} rest={rest} pins={pins} sort={sort} order={order} href={href} />
        )}
      </div>
      <p className="muted mono" style={{ fontSize: 11 }}>
        Source: Finnhub (free plan, US listings only), stored per company{asOf ? `; metrics as of ${asOf}` : ""}. Hover a cell for its as-of date. Blank values read Not loaded and sort last; margins and growth beyond ±1,000% read n/m (the stored value is in the tooltip).
        Region uses the revenue-by-region rows, as on the map: a company with no revenue split is not placed in any region. Analyst counts describe ratings and are not a recommendation.
      </p>
    </main>
  );
}
