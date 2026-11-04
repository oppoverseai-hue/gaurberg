"use client";
// Landing search (TRM-1): type-ahead over every company in the graph, matched in the browser from one preloaded index (names, tickers, aliases).
// Before typing it shows Recent (this browser only) and Try (best-connected companies).
// Keys: ↑ ↓ move, Enter opens, Shift+Enter or Ctrl/Cmd+M opens the map, Esc closes.
// A mapped company opens its page; an unmapped one opens the map it sits on, with its panel open. Only a name that matches nothing
// falls back to the live lookup on /search.
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { search, top, type Entry, type Hit } from "@/lib/search-core";

const KEY = "gaurberg.recent";
const readRecent = (): Hit[] => { try { return (JSON.parse(localStorage.getItem(KEY) ?? "[]") as Hit[]).filter((r) => r && typeof r.href === "string").slice(0, 4); } catch { return []; } };
const saveRecent = (s: Hit) => { try { localStorage.setItem(KEY, JSON.stringify([s, ...readRecent().filter((r) => r.id !== s.id)].slice(0, 4))); } catch {} };

type Row = Hit & { group?: string };

export default function LandingSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState<Entry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [recent, setRecent] = useState<Hit[]>([]);
  const [sel, setSel] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const typed = q.trim().length > 0;

  const inp = useRef<HTMLInputElement>(null);
  useEffect(() => { setRecent(readRecent()); }, []);
  useEffect(() => {
    let live = true;
    fetch("/api/search-index").then((r) => (r.ok ? r.json() : Promise.reject())).then((j) => { if (live) setIndex(j.items ?? []); }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); inp.current?.focus(); setOpen(true); } };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, []);
  useEffect(() => {
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", away); return () => document.removeEventListener("mousedown", away);
  }, []);
  useEffect(() => { setSel(0); }, [q]);

  const items = useMemo(() => (index ? (typed ? search(index, q) : top(index)) : []), [index, q, typed]);
  const rows: Row[] = typed ? items
    : [...recent.map((r) => ({ ...r, group: "Recent" })), ...items.filter((i) => !recent.some((r) => r.id === i.id)).map((r) => ({ ...r, group: "Try" }))];
  const live = typed && !!index && items.length === 0;
  const go = (r: Hit, map = false) => { saveRecent(r); setOpen(false); router.push(map ? r.mapHref : r.href); };
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
      <div className="ls-field">
        <svg className="ls-ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input ref={inp} type="search" value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKey}
          placeholder="Search a company or ticker" aria-label="Search a company or ticker" role="combobox" aria-expanded={open} aria-controls="ls-list" aria-autocomplete="list" autoComplete="off" autoFocus />
        {typed ? <button type="button" className="ls-clear" aria-label="Clear search" onClick={() => { setQ(""); inp.current?.focus(); }}>×</button> : <kbd className="ls-k">Ctrl K</kbd>}
      </div>
      {open && (rows.length > 0 || live || (typed && (failed || !index))) && (
        <div className="ls-pop" id="ls-list" role="listbox">
          {typed && !index && <div className="ls-row"><span className="ls-name muted">{failed ? "Search is not available right now. Press Enter to search anyway." : "Loading…"}</span></div>}
          {rows.map((r, i) => {
            const head = r.group && r.group !== lastGroup ? r.group : null; if (r.group) lastGroup = r.group;
            return (
              <div key={`${r.group}-${r.id}`}>
                {head && <div className="ls-head">{head}</div>}
                <div className={`ls-row${i === sel ? " on" : ""}`} role="option" aria-selected={i === sel} onMouseEnter={() => setSel(i)} onMouseDown={(e) => { e.preventDefault(); go(r); }}>
                  {r.ticker ? <span className="tag">{r.ticker}</span> : <span className="tag ls-notk">no ticker</span>}
                  <span className="ls-name">{r.name}{r.alias && <span className="muted"> · also “{r.alias}”</span>}</span>
                  {r.mapped ? r.markets.map((m) => <span key={m} className="mk">{m}</span>)
                    : r.context ? <span className="ls-unm" title={`Not mapped yet. Opens the ${r.context.name} map with this company selected.`}>On the {r.context.ticker} map</span>
                    : <span className="ls-unm">Unmapped</span>}
                  <span className="ls-n">{r.links} {r.links === 1 ? "link" : "links"}</span>{i === sel && <kbd className="ls-enter">Enter</kbd>}
                </div>
              </div>
            );
          })}
          {live && (
            <div className={`ls-row${sel === 0 ? " on" : ""}`} role="option" aria-selected={sel === 0} onMouseDown={(e) => { e.preventDefault(); lookup(); }}>
              <span className="ls-name">“{q.trim()}” is not in the graph yet <span className="ls-unm">Unmapped</span><br /><b>Look it up live from its latest annual report →</b></span>
            </div>
          )}
          <div className="ls-foot"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>Enter</kbd> open</span><span><kbd>Shift</kbd>+<kbd>Enter</kbd> map</span><span><kbd>Esc</kbd> close</span></div>
        </div>
      )}
    </div>
  );
}
