"use client";
// Landing search: type-ahead over mapped companies. Before typing it shows Recent (this browser only) and Try (best-connected companies).
// Keys: ↑ ↓ move, Enter opens the company, Shift+Enter or M opens the map, Esc closes. Unmapped names fall back to the live lookup on /search.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Suggestion } from "@/lib/suggest";

const KEY = "gaurberg.recent";
const readRecent = (): Suggestion[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? "[]").slice(0, 4); } catch { return []; } };
const saveRecent = (s: Suggestion) => { try { localStorage.setItem(KEY, JSON.stringify([s, ...readRecent().filter((r) => r.ticker !== s.ticker)].slice(0, 4))); } catch {} };

type Row = Suggestion & { group?: string };

export default function LandingSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [recent, setRecent] = useState<Suggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState(0);
  const seq = useRef(0);
  const box = useRef<HTMLDivElement>(null);
  const typed = q.trim().length > 0;

  useEffect(() => { setRecent(readRecent()); }, []);
  useEffect(() => {
    const id = ++seq.current;
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/suggest?q=${encodeURIComponent(q.trim())}`);
        const j = r.ok ? await r.json() : { items: [] };
        if (id === seq.current) { setItems(j.items ?? []); setSel(0); }
      } catch { if (id === seq.current) setItems([]); }
      if (id === seq.current) setBusy(false);
    }, typed ? 120 : 0);
    return () => clearTimeout(t);
  }, [q, typed]);
  useEffect(() => {
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", away); return () => document.removeEventListener("mousedown", away);
  }, []);

  const rows: Row[] = typed ? items
    : [...recent.map((r) => ({ ...r, group: "Recent" })), ...items.filter((i) => !recent.some((r) => r.ticker === i.ticker)).slice(0, 5).map((r) => ({ ...r, group: "Try" }))];
  const live = typed && !busy && items.length === 0;
  const go = (r: Suggestion, map = false) => { saveRecent(r); setOpen(false); router.push(`/${map ? "map" : "company"}/${r.ticker}`); };
  const lookup = () => router.push(`/search?q=${encodeURIComponent(q.trim())}`);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setSel((s) => Math.min(s + 1, Math.max(rows.length - 1 + (live ? 1 : 0), 0))); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === "Escape") setOpen(false);
    else if (e.key === "Enter") {
      e.preventDefault();
      if (rows[sel]) go(rows[sel], e.shiftKey);
      else if (typed) lookup();
    } else if ((e.key === "m" || e.key === "M") && (e.metaKey || e.ctrlKey) && rows[sel]) { e.preventDefault(); go(rows[sel], true); }
  };

  let lastGroup = "";
  return (
    <div className="lsearch" ref={box}>
      <input type="search" value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKey}
        placeholder="Search a company or ticker" aria-label="Search a company or ticker" role="combobox" aria-expanded={open} aria-controls="ls-list" aria-autocomplete="list" autoComplete="off" autoFocus />
      {open && (rows.length > 0 || live) && (
        <div className="ls-pop" id="ls-list" role="listbox">
          {rows.map((r, i) => {
            const head = r.group && r.group !== lastGroup ? r.group : null; if (r.group) lastGroup = r.group;
            return (
              <div key={`${r.group}-${r.ticker}`}>
                {head && <div className="ls-head">{head}</div>}
                <div className={`ls-row${i === sel ? " on" : ""}`} role="option" aria-selected={i === sel} onMouseEnter={() => setSel(i)} onMouseDown={(e) => { e.preventDefault(); go(r); }}>
                  <span className="tag">{r.ticker}</span>
                  <span className="ls-name">{r.name}</span>
                  {r.markets.map((m) => <span key={m} className="mk">{m}</span>)}
                  <span className="ls-n">{r.links} links</span>
                </div>
              </div>
            );
          })}
          {live && (
            <div className={`ls-row${sel === 0 ? " on" : ""}`} role="option" aria-selected={sel === 0} onMouseDown={(e) => { e.preventDefault(); lookup(); }}>
              <span className="ls-name">“{q.trim()}” is not mapped yet. <b>Look it up live</b> from its latest annual report</span>
            </div>
          )}
          <div className="ls-foot"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>Enter</kbd> company</span><span><kbd>Shift</kbd>+<kbd>Enter</kbd> map</span><span><kbd>Esc</kbd> close</span></div>
        </div>
      )}
    </div>
  );
}
