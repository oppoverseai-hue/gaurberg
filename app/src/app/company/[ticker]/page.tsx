import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getAccess, supabaseServer } from "@/lib/supabase/server";
import { getCandles, getQuote } from "@/lib/finnhub";
import PriceChart from "@/components/PriceChart";

export const dynamic = "force-dynamic";

export default async function Company({ params }: { params: Promise<{ ticker: string }> }) {
  const access = await getAccess();
  if (access.state !== "ok") redirect("/");
  const ticker = (await params).ticker.toUpperCase();
  const supabase = await supabaseServer();
  const { data: company } = await supabase.from("companies").select("ticker,name,segment,size_tier").eq("ticker", ticker).maybeSingle();
  if (!company) notFound();
  const [q, c] = await Promise.all([getQuote(ticker), getCandles(ticker)]);
  return (
    <main>
      <Link href="/">← Search</Link>
      <h1>{company.name} <span className="muted">({company.ticker})</span></h1>
      <p className="muted">{company.segment} · {company.size_tier} cap</p>
      <div className="card">
        {q.ok ? (
          <>
            <div className="price">${q.quote.price.toFixed(2)}{" "}
              <span className={q.quote.change >= 0 ? "up" : "down"} style={{ fontSize: 18 }}>
                {q.quote.change >= 0 ? "+" : ""}{q.quote.change.toFixed(2)} ({q.quote.changePct.toFixed(2)}%)
              </span>
            </div>
            <div className="row muted">
              <div>Open<br />{q.quote.open.toFixed(2)}</div>
              <div>High<br />{q.quote.high.toFixed(2)}</div>
              <div>Low<br />{q.quote.low.toFixed(2)}</div>
              <div>Prev close<br />{q.quote.prevClose.toFixed(2)}</div>
            </div>
          </>
        ) : (
          <p className="muted">Data unavailable: {q.reason}</p>
        )}
      </div>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Price, last 12 months</h2>
        {c.ok ? <PriceChart points={c.points} /> : <p className="muted">Data unavailable: {c.reason}</p>}
      </div>
      <p className="muted">Prices from Finnhub, delayed or end-of-day on the free plan.</p>
    </main>
  );
}
