"use client";
// Moving index ticker. Shows only the indices a provider answered; hides itself if none. Green/red are for the price move only (glyph plus sign too).
import { useEffect, useState } from "react";
import type { IndexQuote } from "@/lib/indices";

export default function IndexTicker() {
  const [items, setItems] = useState<IndexQuote[]>([]);
  useEffect(() => {
    let live = true;
    const load = () => fetch("/api/indices").then((r) => (r.ok ? r.json() : { items: [] })).then((j) => { if (live) setItems(j.items ?? []); }).catch(() => {});
    load(); const t = setInterval(load, 300000);
    return () => { live = false; clearInterval(t); };
  }, []);
  if (!items.length) return null;
  const reps = Math.max(1, Math.ceil(8 / items.length));
  const row = Array.from({ length: reps }, (_, k) => items.map((i) => (
    <span key={`${k}-${i.id}`} className="ix">
      <span className="ix-n">{i.label}</span>
      <span className="ix-p">{i.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
      <span className={i.changePct >= 0 ? "ix-up" : "ix-dn"}>{i.changePct >= 0 ? "▲" : "▼"} {i.changePct >= 0 ? "+" : ""}{i.changePct.toFixed(2)}%</span>
    </span>
  ))).flat();
  return (
    <div className="ixbar" role="region" aria-label="Market indices, delayed">
      <div className="ix-track" aria-hidden={false}>{row}<span aria-hidden="true" style={{ display: "contents" }}>{row}</span></div>
      <span className="ix-note">Delayed</span>
    </div>
  );
}
