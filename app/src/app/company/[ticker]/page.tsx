import { isOffline } from "@/lib/mode";
import NewsPanel from "@/components/NewsPanel";
import { getNews } from "@/lib/news";
import { getInsiderTrades } from "@/lib/insiders";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getAccess } from "@/lib/supabase/server";
import { fmtBig, fmtShares } from "@/lib/finnhub";
import { getCompany, getRels, recordView } from "@/lib/data";
import { getMarket } from "@/lib/market";
import { getMetrics, getUpcomingEvents, isUSListed, type Metrics } from "@/lib/marketdb";
import PeriodChart from "@/components/PeriodChart";
import CompanyTabs from "@/components/CompanyTabs";
import { buildNodes, isMapped, TYPE_LABEL } from "@/lib/graph";

export const dynamic = "force-dynamic";

const NA = "Not available";
const cap = (v: string | null | undefined) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : null);
const pct = (v: number | null | undefined) => (v == null ? null : `${v.toFixed(1)}%`);
const n2 = (v: number | null | undefined) => (v == null ? null : v.toFixed(2));
const day = (d: string) => new Date(d.length === 10 ? `${d}T00:00:00Z` : d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const NOT_LOADED = "Not loaded: source is the annual report.";

// Stored metrics strip (M17): one dated Finnhub fetch, never filled from another source. Staged rows are labelled.
function MetricsStrip({ mt, us }: { mt: Metrics | null; us: boolean }) {
  if (!mt) return <p className="muted mono" style={{ fontSize: 12, margin: 0 }}>{us ? "Not loaded yet." : NOT_LOADED}</p>;
  const x = (v: number | null) => (v == null ? null : `${v.toFixed(1)}x`);
  const recs = mt.rec_period == null ? null : [["Strong buy", mt.rec_strong_buy], ["Buy", mt.rec_buy], ["Hold", mt.rec_hold], ["Sell", mt.rec_sell], ["Strong sell", mt.rec_strong_sell]] as const;
  // Margins and growth beyond +/-1,000% are shown as n/m (not meaningful), with the stored value in the tooltip. Stored data is unchanged.
  const nm = (v: number | null): [string | null, string | undefined] => (v != null && Math.abs(v) > 1000 ? ["n/m", `${pct(v)} as reported by Finnhub; not meaningful beyond ±1,000%`] : [pct(v), undefined]);
  const tiles: [string, string | null, string?][] = [
    ["P/E (TTM)", x(mt.pe_ttm)], ["EV / EBITDA (TTM)", x(mt.ev_ebitda)], ["Operating margin (TTM)", ...nm(mt.operating_margin)],
    ["Net margin (TTM)", ...nm(mt.net_margin)], ["Revenue growth (YoY, TTM)", ...nm(mt.revenue_growth_yoy)], ["Debt to equity", n2(mt.debt_to_equity)],
  ];
  return (
    <>
      <div className="stats" style={{ marginTop: 0, paddingTop: 0, borderTop: 0 }}>
        {tiles.map(([k, v, tip]) => <div key={k}><div className="k">{k}</div><div className={`v ${v == null || tip ? "muted" : ""}`} title={tip}>{v ?? NA}</div></div>)}
      </div>
      <p className="mono" style={{ fontSize: 12, margin: "12px 0 0" }}>
        Analyst ratings{recs ? ` (${day(mt.rec_period!)})` : ""}: {recs ? recs.map(([k, v]) => `${v ?? NA} ${k.toLowerCase()}`).join(" · ") : <span className="muted">{NA}</span>}
      </p>
      <p className="muted mono" style={{ fontSize: 10, margin: "8px 0 0" }}>
        Source: Finnhub, fetched {day(mt.fetched_at)}{mt.data_period ? `; trailing figures through the quarter ended ${day(mt.data_period)}` : ""}.{mt.status === "staged" ? " Staged, not yet reviewed." : ""}{mt.note ? ` ${mt.note}.` : ""} Analyst counts describe ratings and are not a recommendation.
      </p>
    </>
  );
}

function Rows({ rows }: { rows: [string, string | null | undefined][] }) {
  return <dl className="fund">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className={v == null ? "muted" : ""}>{v ?? NA}</dd></div>)}</dl>;
}

export default async function Company({ params }: { params: Promise<{ ticker: string }> }) {
  const access = await getAccess();
  if (access.state !== "ok") redirect("/");
  const ticker = (await params).ticker.toUpperCase();
  const company = await getCompany(ticker);
  if (!company) notFound();
  await recordView(company.id);
  const insiders = isOffline() ? { trades: [], checked: 0, error: "Offline: insider trades are not saved for the offline demo." } : await getInsiderTrades(ticker);
  const [m, { rels }, mt, events, news] = await Promise.all([getMarket(ticker), getRels(company.id), getMetrics(company.id), getUpcomingEvents(company.id), isOffline() ? Promise.resolve({ items: [], errors: ["Offline: news is not saved for the offline demo."] }) : getNews(ticker)]);
  const q = m.quote, f = m.f ?? {}, p = m.profile;
  const up = !!q && q.change >= 0;
  const asOf = q?.t ? new Date(q.t * 1000).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC" : null;
  const us = isUSListed(company.markets);
  const top = buildNodes(rels, company.id).slice(0, 5);
  return (
    <main>
      <Link href="/" className="mono" style={{ fontSize: 12 }}>← Search</Link>
      <div className="head">
        <div className="row1">
          <h1>{company.name}</h1>
          <span className="tag">{company.ticker}</span>{p?.exchange && <span className="tag">{p.exchange}</span>}{(company.markets ?? []).map((m) => <span className="tag" key={m}>{m}</span>)}
        </div>
        <div className="meta">
          <span>{cap(company.segment) ?? NA}</span><span className="muted">•</span><span>{company.size_tier ? `${cap(company.size_tier)} cap` : NA}</span>
        </div>
        <p className="mono" style={{ fontSize: 12, margin: "8px 0 0" }} id="events">
          <span className="muted">Upcoming events: </span>
          {events.length ? <>{events.map((e) => `${e.event_type === "earnings" ? "Earnings" : e.event_type} ${day(e.event_date)}${e.detail ? ` (${e.detail})` : ""}`).join(" · ")}<span className="muted"> · Finnhub, fetched {day(events[0].fetched_at)}{events.some((e) => e.status === "staged") ? ", staged" : ""}</span></> : <span className="muted">{us ? "none loaded" : NOT_LOADED}</span>}
        </p>
      </div>
      <CompanyTabs ticker={company.ticker ?? ticker} active="overview" />
      {m.saved && <p className="savedbar">Showing saved data{m.saved.parts.length ? ` for ${m.saved.parts.join(", ")}` : ""} from {m.saved.at}{m.saved.source === "manual" ? " (provided by admin)" : ""}. Live data was not available.</p>}
      <div className="grid2">
        <section className="stack">
          <div className="card" id="price">
            {q ? (
              <>
                <div className="price">${q.price.toFixed(2)}
                  <span className={`pill ${up ? "up" : "down"}`}>{up ? "▲" : "▼"} {up ? "+" : ""}{q.change.toFixed(2)} ({q.changePct.toFixed(2)}%)</span>
                </div>
                <p className="muted mono" style={{ fontSize: 11, margin: "8px 0 0" }}>{asOf ? `Price as of ${asOf}. ` : ""}Prices are delayed.</p>
                <div className="stats">
                  <div><div className="k">Open</div><div className="v">{q.open.toFixed(2)}</div></div>
                  <div><div className="k">Day range</div><div className="v">{q.low.toFixed(2)} - {q.high.toFixed(2)}</div></div>
                  <div><div className="k">Prev close</div><div className="v">{q.prevClose.toFixed(2)}</div></div>
                  <div><div className="k">52-week range</div><div className={`v ${f.low52 == null ? "muted" : ""}`}>{f.low52 != null && f.high52 != null ? `${f.low52.toFixed(2)} - ${f.high52.toFixed(2)}` : NA}</div></div>
                </div>
              </>
            ) : (
              <div className="errcard" style={{ border: 0, padding: 0 }}>
                <p>⚠ Data unavailable: {m.quoteError ?? "no price"}</p>
                <p className="sub"><Link href={`/company/${company.ticker}`}>Retry</Link></p>
              </div>
            )}
          </div>
          <div className="card" id="chart">
            <div className="cardhead"><span className="t">Price <span className="label" style={{ marginLeft: 8 }}>Daily closing</span></span></div>
            {m.daily ? <PeriodChart daily={m.daily} weekly={m.weekly} /> : <div className="errcard" style={{ border: 0, padding: 0 }}><p>⚠ Data unavailable: {m.historyError ?? "no price history"}</p></div>}
          </div>
          <div className="card" id="metrics">
            <div className="cardhead"><h3>Key metrics</h3><span className="label">Finnhub, stored</span></div>
            <MetricsStrip mt={mt} us={us} />
          </div>
          <div className="card" id="insiders">
            <div className="cardhead"><h3>Insider trades</h3><span className="label">SEC Form 4</span></div>
            {insiders.error && <p className="muted mono" style={{ fontSize: 11, margin: "0 0 6px" }}>⚠ {insiders.error}</p>}
            {!insiders.trades.length ? <p className="muted mono" style={{ fontSize: 12, margin: 0 }}>{insiders.error ? "Insider trades are not available right now." : `No open-market buys or sells in the last 90 days (${insiders.checked} Form 4 filings read).`}</p> : (() => {
              const b = insiders.trades.filter((t) => t.side === "Buy"), sl = insiders.trades.filter((t) => t.side === "Sell");
              const sum = (a: { shares: number }[]) => a.reduce((n, t) => n + t.shares, 0).toLocaleString("en-US");
              return (
                <>
                  <p style={{ margin: "0 0 8px", fontSize: 13 }}>Last 90 days: {sl.length} sale{sl.length === 1 ? "" : "s"} ({sum(sl)} shares) by {new Set(sl.map((t) => t.insider)).size} insider{new Set(sl.map((t) => t.insider)).size === 1 ? "" : "s"}; {b.length} purchase{b.length === 1 ? "" : "s"} ({sum(b)} shares) by {new Set(b.map((t) => t.insider)).size}.</p>
                  {insiders.trades.slice(0, 10).map((t, i) => (
                    <a key={t.url + i} className="resrow" style={{ display: "block" }} href={t.url} target="_blank" rel="noopener noreferrer">
                      <div><strong>{t.side}</strong> {t.shares.toLocaleString("en-US")} shares{t.price ? ` at $${t.price.toFixed(2)}` : ""} · {t.insider}</div>
                      <div className="muted mono" style={{ fontSize: 11 }}>{t.role} · traded {t.date} · filed {t.filed}</div>
                    </a>
                  ))}
                </>
              );
            })()}
            <p className="muted mono" style={{ fontSize: 10, margin: "8px 0 0" }}>Open-market purchases and sales only, from the latest {insiders.checked} Form 4 filings (within 90 days). Plans set in advance are not separated. This describes filings and is not a recommendation.</p>
          </div>
          <div className="card" id="news">
            <div className="cardhead"><h3>Recent news</h3><span className="label">Finnhub and SEC EDGAR</span></div>
            <NewsPanel items={news.items} errors={news.errors} />
          </div>
        </section>
        <aside className="stack">
          <div className="card" id="numbers">
            <div className="cardhead"><h3>Key numbers</h3><span className="label">Finnhub</span></div>
            <Rows rows={[
              ["Previous close", q ? q.prevClose.toFixed(2) : null],
              ["Day range", q ? `${q.low.toFixed(2)} - ${q.high.toFixed(2)}` : null],
              ["52-week range", f.low52 != null && f.high52 != null ? `${f.low52.toFixed(2)} - ${f.high52.toFixed(2)}` : null],
              ["Avg volume", f.avgVolume == null ? null : `${f.avgVolume.toFixed(2)}M`],
              ["Market cap", f.marketCap == null ? null : fmtBig(f.marketCap)],
              ["P/E (trailing)", n2(f.pe)], ["Earnings per share", n2(f.eps) && `$${n2(f.eps)}`], ["Beta", n2(f.beta)],
              ["Shares outstanding", f.shares == null ? null : fmtShares(f.shares)],
              ["Next earnings", m.nextEarnings],
            ]} />
          </div>
          <div className="card" id="about" style={{ marginTop: 24 }}>
            <div className="cardhead"><h3>About</h3></div>
            {p?.description ? <p style={{ margin: "0 0 12px", fontSize: 13, lineHeight: "20px" }}>{p.description}</p> : <p className="muted mono" style={{ fontSize: 12, margin: "0 0 12px" }}>Description: not available yet.</p>}
            {p?.description && p.about_source && <p className="muted mono" style={{ fontSize: 10, margin: "-4px 0 12px" }}>Source: {p.about_source}</p>}
            <Rows rows={[
              ["Sector", p?.industry ?? cap(company.segment)], ["Size group", company.size_tier ? `${cap(company.size_tier)} cap` : null],
              ["Website", p?.website ?? null], ["Employees", p?.employees == null ? null : p.employees.toLocaleString("en-US")],
            ]} />
          </div>
          <div className="card" id="relationships" style={{ marginTop: 24 }}>
            <div className="cardhead"><h3>Top linked companies</h3><span className="tag">{rels.length} links</span></div>
            {top.length === 0 ? <p className="muted">No disclosed relationships found for this company.</p> : (
              <>
                {top.map((n) => (
                  <div className="relitem" key={n.co.id}><span>{isMapped(n.co) ? `${n.co.name} (${n.co.ticker})` : n.co.name}</span><span>{[...new Set(n.links.map((l) => TYPE_LABEL[l.relationship_type]))].join(", ")}</span></div>
                ))}
                <Link className="cta" href={`/map/${company.ticker}`}>Open the ecosystem map →</Link>
              </>
            )}
          </div>
        </aside>
      </div>
      <p className="note">Sources: price and key numbers live from Finnhub (delayed); price history from Twelve Data (end of day; Finnhub candles are not on the free plan); key metrics and upcoming events from a stored Finnhub fetch, dated on each block; news from Finnhub and SEC EDGAR; insider trades from SEC Form 4; financial statements (Financials tab) from SEC EDGAR filings. Where live data fails, saved data is shown and labelled. Finnhub's free plan covers US listings only.</p>
    </main>
  );
}
