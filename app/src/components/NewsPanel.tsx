"use client";
import { useState } from "react";
import type { NewsItem } from "@/lib/news";

const TABS = [["all", "All"], ["news", "News"], ["press", "Press releases"], ["filing", "SEC filings"]] as const;
const WINDOWS = [["1", "Last 24 hours"], ["7", "7 days"], ["30", "30 days"], ["0", "All"]] as const;

// items: headlines that name the company, and its SEC filings. market: the rest of its feed, listed apart under "Market news"
// (TRM-4) so nothing is hidden. The tabs and time window apply to both.
export default function NewsPanel({ items, market = [], name, ticker, errors }: { items: NewsItem[]; market?: NewsItem[]; name?: string; ticker?: string | null; errors: string[] }) {
  const [tab, setTab] = useState<string>("all");
  const [win, setWin] = useState<string>("7");
  const now = Date.now() / 1000;
  const keep = (i: NewsItem) => (tab === "all" || i.kind === tab) && (win === "0" || now - i.ts <= Number(win) * 86400);
  const shown = items.filter(keep), marketShown = market.filter(keep);
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        {TABS.map(([k, l]) => <button key={k} className="tag" onClick={() => setTab(k)} style={{ cursor: "pointer", borderColor: tab === k ? "var(--accent)" : undefined }}>{l}</button>)}
        <span style={{ flex: 1 }} />
        {WINDOWS.map(([k, l]) => <button key={k} className="tag" onClick={() => setWin(k)} style={{ cursor: "pointer", borderColor: win === k ? "var(--accent)" : undefined }}>{l}</button>)}
      </div>
      {errors.map((e) => <p key={e} className="muted mono" style={{ fontSize: 11, margin: "0 0 6px" }}>⚠ {e}</p>)}
      {!shown.length && <p className="muted mono" style={{ fontSize: 12, margin: 0 }}>{errors.length && !items.length && !market.length ? "News is not available right now." : `Nothing${name ? ` naming ${name}` : ""} in this window. Try a longer one.`}</p>}
      {shown.slice(0, 30).map((i) => <Row key={i.url + i.ts} i={i} />)}
      {marketShown.length > 0 && (
        <details className="market-news">
          <summary>Market news · {marketShown.length}</summary>
          <p className="muted mono" style={{ fontSize: 11, margin: "4px 0 6px" }}>Stories the news service files under {ticker ?? "this company"} that do not name the company or its ticker.</p>
          {marketShown.slice(0, 30).map((i) => <Row key={i.url + i.ts} i={i} />)}
        </details>
      )}
    </div>
  );
}

function Row({ i }: { i: NewsItem }) {
  return (
    <a className="resrow" style={{ display: "block" }} href={i.link} target="_blank" rel="noopener noreferrer" title="Opens the article in a new tab">
      <div>{i.headline} <span className="muted" aria-hidden>↗</span></div>
      <div className="muted mono" style={{ fontSize: 11 }}>{i.source} · {new Date(i.ts * 1000).toISOString().slice(0, 16).replace("T", " ")} UTC · {i.kind === "filing" ? "SEC filing" : i.kind === "press" ? "Press release" : "News"}</div>
    </a>
  );
}
