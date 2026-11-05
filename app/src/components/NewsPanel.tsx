"use client";
import { useState } from "react";
import type { NewsItem } from "@/lib/news";

const TABS = [["all", "All"], ["news", "News"], ["press", "Press releases"], ["filing", "SEC filings"]] as const;
const WINDOWS = [["1", "Last 24 hours"], ["7", "7 days"], ["30", "30 days"], ["0", "All"]] as const;

// items: headlines that name the company, and its SEC filings. market: the rest of its feed, listed apart (TRM-4) so nothing is
// hidden and company news is not padded. The tabs and time window apply to both. Each section folds with a real button
// (aria-expanded): company news open, market headlines closed.
export default function NewsPanel({ items, market = [], name, ticker, errors }: { items: NewsItem[]; market?: NewsItem[]; name?: string; ticker?: string | null; errors: string[] }) {
  const [tab, setTab] = useState<string>("all");
  const [win, setWin] = useState<string>("7");
  const now = Date.now() / 1000;
  const keep = (i: NewsItem) => (tab === "all" || i.kind === tab) && (win === "0" || now - i.ts <= Number(win) * 86400);
  const shown = items.filter(keep), marketShown = market.filter(keep);
  const [open, setOpen] = useState({ company: true, market: false });
  const who = name ?? "this company";
  const named = shown.filter((i) => i.kind !== "filing").length; // headlines, not filings: "83 of 152 headlines name Uber"
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        {TABS.map(([k, l]) => <button key={k} className="tag" onClick={() => setTab(k)} style={{ cursor: "pointer", borderColor: tab === k ? "var(--accent)" : undefined }}>{l}</button>)}
        <span style={{ flex: 1 }} />
        {WINDOWS.map(([k, l]) => <button key={k} className="tag" onClick={() => setWin(k)} style={{ cursor: "pointer", borderColor: win === k ? "var(--accent)" : undefined }}>{l}</button>)}
      </div>
      {errors.map((e) => <p key={e} className="muted mono" style={{ fontSize: 11, margin: "0 0 6px" }}>⚠ {e}</p>)}
      <Section id="news-company" title={`${who} in the news`} count={shown.length} open={open.company} onToggle={() => setOpen((o) => ({ ...o, company: !o.company }))}>
        {!shown.length && <p className="muted mono" style={{ fontSize: 12, margin: 0 }}>{errors.length && !items.length && !market.length ? "News is not available right now." : `Nothing naming ${who} in this window. Try a longer one.`}</p>}
        {shown.slice(0, 30).map((i) => <Row key={i.url + i.ts} i={i} />)}
      </Section>
      {marketShown.length > 0 && (
        <Section id="news-market" title={`Sector and market headlines (don't name ${who})`} count={marketShown.length} open={open.market} onToggle={() => setOpen((o) => ({ ...o, market: !o.market }))}
          lede={<>Headlines from the news feed{ticker ? ` for ${ticker}` : ""} that don&apos;t mention {who}: peers, sector and market stories. Shown separately so company news isn&apos;t padded. <span className="mono">{named} of {named + marketShown.length} headlines name {who}.</span></>}>
          {marketShown.slice(0, 30).map((i) => <Row key={i.url + i.ts} i={i} />)}
        </Section>
      )}
    </div>
  );
}

function Section({ id, title, count, open, onToggle, lede, children }: { id: string; title: string; count: number; open: boolean; onToggle: () => void; lede?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="news-sec">
      <h4><button type="button" className="news-toggle" aria-expanded={open} aria-controls={id} onClick={onToggle}>
        <span aria-hidden>{open ? "▾" : "▸"}</span> {title} <span className="muted">· {count}</span>
      </button></h4>
      {lede && <p className="muted news-lede">{lede}</p>}
      <div id={id} hidden={!open}>{children}</div>
    </section>
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
