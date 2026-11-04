"use client";
// "How filings turn into intelligence" (ACC-7): four tabs over one terminal frame. Pure client state, no data calls.
// Advances by itself every 6 s until the visitor picks a tab; no motion when the visitor prefers reduced motion.
import { useEffect, useState } from "react";
import EcoMap from "./EcoMap";

export type Scene = { key: string; tab: string; title: React.ReactNode; body: string; facts: [string, string][]; quote?: { text: string; cite: string }; focus?: string[]; path?: boolean };

export default function Scenes({ scenes }: { scenes: Scene[] }) {
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((x) => (x + 1) % scenes.length), 6000);
    return () => clearInterval(t);
  }, [auto, scenes.length]);
  const s = scenes[i];
  return (
    <div>
      <div className="pp-tabs" role="tablist" aria-label="What Gaurberg does">
        {scenes.map((x, n) => (
          <button key={x.key} role="tab" aria-selected={n === i} className={n === i ? "on" : ""} onClick={() => { setI(n); setAuto(false); }}>
            <span className="pp-mono">{String(n + 1).padStart(2, "0")} / {x.key}</span><span>{x.tab}</span>
          </button>
        ))}
      </div>
      <div className="pp-term pp-scene" role="tabpanel">
        <div className="pp-termbar"><span className="pp-mono">SCENE {String.fromCharCode(65 + i)} · {s.key} · UBER TECHNOLOGIES</span><span className="pp-dots"><i /><i /><i /></span></div>
        <div className="pp-scenebody">
          <div className="pp-scenetext">
            <span className="pp-chip-dark pp-mono">{s.key}</span>
            <h3>{s.title}</h3>
            <p>{s.body}</p>
            {s.facts.length > 0 && <ul className="pp-facts">{s.facts.map(([n, l]) => <li key={l} className="pp-mono"><b>{n}</b> {l}</li>)}</ul>}
            {s.quote && <blockquote className="pp-quote">“{s.quote.text}”<cite className="pp-mono">{s.quote.cite} · quote found word for word</cite></blockquote>}
          </div>
          <div className="pp-scenemap"><EcoMap focus={s.focus} path={s.path} /></div>
        </div>
      </div>
    </div>
  );
}
