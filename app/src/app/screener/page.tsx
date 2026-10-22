import { redirect } from "next/navigation";
import Link from "next/link";
import { getAccess, supabaseServer } from "@/lib/supabase/server";
import { isOffline } from "@/lib/mode";
import { readSnapshot, readMarket, type CoRow } from "@/lib/saved";
import { MARKETS, MARKET_LABEL, type Market } from "@/lib/graph";

export const dynamic = "force-dynamic";

// Screener (TRM-5): mapped companies filtered by segment, size group and the price change over 1 month.
// The 1-month change is computed from saved daily closes (data/market/<TICKER>.json). A company with no saved history shows
// "no saved price history" and is left out as soon as a price-change filter is set. Nothing is estimated.
const SEG = ["consumer", "business", "infrastructure"], SIZE = ["large", "mid", "small"];

function monthChange(ticker: string): { pct: number; from: string } | null {
  const d = readMarket(ticker)?.daily;
  if (!d || d.length < 2) return null;
  const last = d[d.length - 1], target = last.t - 30 * 86400;
  const base = [...d].reverse().find((p) => p.t <= target);
  if (!base || base.c === 0) return null;
  return { pct: ((last.c - base.c) / base.c) * 100, from: new Date(base.t * 1000).toISOString().slice(0, 10) };
}

export default async function Screener({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const access = await getAccess();
  if (access.state !== "ok") redirect("/");
  const q = await searchParams;
  const seg = SEG.includes(q.segment ?? "") ? q.segment : "", size = SIZE.includes(q.size ?? "") ? q.size : "";
  const mkt = MARKETS.includes(q.market as Market) ? (q.market as Market) : "";
  const dir = q.dir === "down" ? "down" : q.dir === "up" ? "up" : "";
  let cos: CoRow[] = [];
  if (isOffline()) cos = (readSnapshot()?.companies ?? []).filter((c) => c.is_seed && c.ticker);
  else {
    const supabase = await supabaseServer();
    cos = ((await supabase.from("companies").select("id,ticker,name,is_seed,entity_type,segment,size_tier,markets").eq("is_seed", true).not("ticker", "is", null)).data ?? []) as CoRow[];
  }
  const rows = cos.map((c) => ({ c, ch: monthChange(c.ticker!) }))
    .filter(({ c, ch }) => (!seg || c.segment === seg) && (!size || c.size_tier === size) && (!mkt || (c.markets ?? []).includes(mkt)) && (!dir || (ch && (dir === "up" ? ch.pct >= 0 : ch.pct < 0))))
    .sort((a, b) => (b.ch?.pct ?? -1e9) - (a.ch?.pct ?? -1e9) || a.c.name.localeCompare(b.c.name));
  const withData = cos.filter((c) => monthChange(c.ticker!)).length;
  return (
    <main className="narrow">
      <Link href="/" className="mono" style={{ fontSize: 12 }}>← Home</Link>
      <h1 style={{ marginTop: 12 }}>Screener</h1>
      <p className="muted">Mapped companies, filtered by market, segment, size group and price change over 1 month.</p>
      <form method="get" className="card" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <select name="segment" defaultValue={seg}><option value="">All segments</option>{SEG.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}</select>
        <select name="size" defaultValue={size}><option value="">All sizes</option>{SIZE.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}</select>
        <select name="market" defaultValue={mkt}><option value="">All markets</option>{MARKETS.map((m) => <option key={m} value={m}>{MARKET_LABEL[m]}</option>)}</select>
        <select name="dir" defaultValue={dir}><option value="">Any 1-month change</option><option value="up">Up over 1 month</option><option value="down">Down over 1 month</option></select>
        <button className="btn">Apply</button> <Link href="/screener" className="mono" style={{ fontSize: 12 }}>Reset</Link>
      </form>
      <div className="card">
        <div className="cardhead"><h3>Results</h3><span className="tag">{rows.length} companies</span></div>
        {!rows.length && <p className="muted mono" style={{ fontSize: 12, margin: 0 }}>No company matches these filters.</p>}
        {rows.map(({ c, ch }) => (
          <Link key={c.id} href={`/company/${c.ticker}`} className="resrow">
            <span><strong>{c.name}</strong> <span className="muted mono" style={{ fontSize: 11 }}>{c.ticker} · {(c.markets ?? []).join("/") || "n/a"} · {c.segment ?? "n/a"} · {c.size_tier ?? "n/a"}</span></span>
            <span className="mono" style={{ fontSize: 12, color: ch ? (ch.pct >= 0 ? "var(--ok, #34d399)" : "var(--bad, #f87171)") : "var(--muted)" }}>{ch ? `${ch.pct >= 0 ? "+" : ""}${ch.pct.toFixed(1)}% since ${ch.from}` : "no saved price history"}</span>
          </Link>
        ))}
        <p className="muted mono" style={{ fontSize: 11, marginBottom: 0 }}>{withData} of {cos.length} companies have saved price history. Run <code>node --env-file=.env scripts/save-market.mjs</code> to save the rest. Prices are end-of-day closes from saved data.</p>
      </div>
    </main>
  );
}
