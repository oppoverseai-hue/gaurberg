import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getAccess, supabaseServer } from "@/lib/supabase/server";
import { getHistory, getQuote } from "@/lib/finnhub";
import PriceChart from "@/components/PriceChart";
import { isMapped, sideOf, type Rel } from "@/lib/graph";

export const dynamic = "force-dynamic";

const SEL = "id,relationship_type,status," +
  "source:companies!relationships_source_id_fkey(id,ticker,name,is_seed,entity_type),target:companies!relationships_target_id_fkey(id,ticker,name,is_seed,entity_type)";

export default async function Company({ params }: { params: Promise<{ ticker: string }> }) {
  const access = await getAccess();
  if (access.state !== "ok") redirect("/");
  const ticker = (await params).ticker.toUpperCase();
  const supabase = await supabaseServer();
  const { data: company } = await supabase.from("companies").select("id,ticker,name,segment,size_tier").eq("ticker", ticker).maybeSingle();
  if (!company) notFound();
  const [q, c, rr] = await Promise.all([
    getQuote(ticker), getHistory(ticker),
    supabase.from("relationships").select(SEL).or(`source_id.eq.${company.id},target_id.eq.${company.id}`),
  ]);
  const rels = (rr.data ?? []) as unknown as Rel[];
  // Key relationships come from the same visible links as the map. Left side = into the company, right = out of it.
  const groups: { title: string; items: { name: string; note: string }[] }[] = [
    { title: "Into this company", items: [] }, { title: "Competitors", items: [] }, { title: "Partners", items: [] },
  ];
  const seen = new Set<string>();
  for (const r of rels) {
    const s = sideOf(r, company.id);
    const other = r.source.id === company.id ? r.target : r.source;
    const g = s === "top" ? groups[1] : s === "bottom" ? groups[2] : s === "left" ? groups[0] : null;
    const key = `${g?.title}|${other.id}`;
    if (!g || seen.has(key)) continue;
    seen.add(key);
    g.items.push({ name: isMapped(other) ? `${other.name} (${other.ticker})` : other.name, note: r.relationship_type === "supplies" ? "supplies" : r.relationship_type === "sells_to" ? "sells to" : r.relationship_type === "invests" ? "invests" : r.relationship_type === "acquires" ? "acquired" : "" });
  }
  const up = q.ok && q.quote.change >= 0;
  return (
    <main>
      <Link href="/" className="mono" style={{ fontSize: 12 }}>← Search</Link>
      <div className="head">
        <div className="row1">
          <h1>{company.name}</h1>
          <span className="tag">{company.ticker}</span>
        </div>
        <div className="meta">
          <span>{company.segment}</span><span className="muted">•</span><span>{company.size_tier} cap</span><span className="muted">•</span>
          <Link className="linkchip" href={`/map/${company.ticker}`}>Ecosystem map →</Link>
        </div>
      </div>
      <div className="grid2">
        <section className="stack">
          <div className="card">
            {q.ok ? (
              <>
                <div className="price">${q.quote.price.toFixed(2)}
                  <span className={`pill ${up ? "up" : "down"}`}>{up ? "▲" : "▼"} {up ? "+" : ""}{q.quote.change.toFixed(2)} ({q.quote.changePct.toFixed(2)}%)</span>
                </div>
                <div className="stats">
                  <div><div className="k">Open</div><div className="v">{q.quote.open.toFixed(2)}</div></div>
                  <div><div className="k">High</div><div className="v">{q.quote.high.toFixed(2)}</div></div>
                  <div><div className="k">Low</div><div className="v">{q.quote.low.toFixed(2)}</div></div>
                  <div><div className="k">Prev close</div><div className="v">{q.quote.prevClose.toFixed(2)}</div></div>
                </div>
              </>
            ) : (
              <div className="errcard" style={{ border: 0, padding: 0 }}>
                <p>⚠ Data unavailable: {q.reason}</p>
                <p className="sub"><Link href={`/company/${company.ticker}`}>Retry</Link></p>
              </div>
            )}
          </div>
          <div className="card">
            <div className="cardhead"><span className="t">Price, last 12 months <span className="label" style={{ marginLeft: 8 }}>Daily closing</span></span></div>
            {c.ok ? <PriceChart points={c.points} /> : <div className="errcard" style={{ border: 0, padding: 0 }}><p>⚠ Data unavailable: {c.reason}</p></div>}
          </div>
        </section>
        <aside className="stack">
          <div className="card">
            <div className="cardhead"><h3>Key relationships</h3><span className="tag">{rels.length} links</span></div>
            {rels.length === 0 ? <p className="muted">No disclosed relationships found for this company.</p> : (
              <>
                {groups.filter((g) => g.items.length > 0).map((g) => (
                  <div className="relgroup" key={g.title}>
                    <div className="label">{g.title} ({g.items.length})</div>
                    {g.items.slice(0, 3).map((i) => <div className="relitem" key={i.name}><span>{i.name}</span><span>{i.note}</span></div>)}
                  </div>
                ))}
                <Link className="cta" href={`/map/${company.ticker}`}>Open the ecosystem map →</Link>
              </>
            )}
          </div>
        </aside>
      </div>
      <p className="note">Prices from Finnhub, delayed or end-of-day on the free plan.</p>
    </main>
  );
}
