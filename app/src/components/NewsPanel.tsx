"use client";
import { useState } from "react";
import type { NewsItem } from "@/lib/news";

const TABS = [["all", "All"], ["news", "News"], ["press", "Press releases"], ["filing", "SEC filings"]] as const;
const WINDOWS = [["1", "Last 24 hours"], ["7", "7 days"], ["30", "30 days"], ["0", "All"]] as const;

export default function NewsPanel({ items, errors }: { items: NewsItem[]; errors: string[] }) {
  const [tab, setTab] = useState<string>("all");
  const [win, setWin] = useState<string>("7");
  const now = Date.now() / 1000;
  const shown = items.filter((i) => (tab === "all" || i.kind === tab) && (win === "0" || now - i.ts <= Number(win) * 86400));
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        {TABS.map(([k, l]) => <button key={k} className="tag" onClick={() => setTab(k)} style={{ cursor: "pointer", borderColor: tab === k ? "var(--accent)" : undefined }}>{l}</button>)}
        <span style={{ flex: 1 }} />
        {WINDOWS.map(([k, l]) => <button key={k} className="tag" onClick={() => setWin(k)} style={{ cursor: "pointer", borderColor: win === k ? "var(--accent)" : undefined }}>{l}</button>)}
      </div>
      {errors.map((e) => <p key={e} className="muted mono" style={{ fontSize: 11, margin: "0 0 6px" }}>⚠ {e}</p>)}
      {!shown.length && <p className="muted mono" style={{ fontSize: 12, margin: 0 }}>{errors.length && !items.length ? "News is not available right now." : "Nothing in this window. Try a longer one."}</p>}
      {shown.slice(0, 30).map((i) => (
        <a key={i.url + i.ts} className="resrow" style={{ display: "block" }} href={i.url} target="_blank" rel="noopener noreferrer">
          <div>{i.headline}</div>
          <div className="muted mono" style={{ fontSize: 11 }}>{i.source} · {new Date(i.ts * 1000).toISOString().slice(0, 16).replace("T", " ")} UTC · {i.kind === "filing" ? "SEC filing" : i.kind === "press" ? "Press release" : "News"}</div>
        </a>
      ))}
    </div>
  );
}
