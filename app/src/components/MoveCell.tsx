"use client";
// One move in an earnings table (GRF-20, UX-4). A hover shows the note on a desktop (title); a tap or Enter opens the same note in a
// small popover, which closes on a second tap, Escape, or a scroll, so it also works on touch and from the keyboard. The popover is
// placed against the screen, not inside the table's sideways-scrolling box, so that box cannot clip it.
import { useEffect, useId, useRef, useState } from "react";

const W = 220, EDGE = 8;

export default function MoveCell({ text, cls, note }: { text: string; cls?: string; note: string }) {
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!at) return;
    const close = () => setAt(null);
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", esc);
    window.addEventListener("scroll", close, true); // page or table scroll: the popover would drift from its cell
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("keydown", esc); window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [at]);
  const toggle = () => {
    if (at || !btn.current) return setAt(null);
    const r = btn.current.getBoundingClientRect();
    const left = Math.min(Math.max(EDGE, r.right - W), window.innerWidth - W - EDGE);
    setAt({ left: Math.max(EDGE, left), top: r.bottom + 4 });
  };
  return (
    <span className="mcell">
      <button ref={btn} type="button" className={`mcell-btn ${cls ?? ""}`} title={note} aria-label={`${text}: ${note}`} aria-expanded={!!at} aria-controls={id} onClick={toggle}>{text}</button>
      {at && <span id={id} role="note" className="mcell-pop" style={{ left: at.left, top: at.top, maxWidth: W }}>{note}</span>}
    </span>
  );
}
