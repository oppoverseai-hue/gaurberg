"use client";
// A section that starts closed (UX-4): a button with aria-expanded opens and closes the same content.
import { useId, useState, type ReactNode } from "react";

export default function Collapsible({ title, className, children }: { title: string; className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <section className={`card collapsible ${className ?? ""}`}>
      <button type="button" className="collapsible-btn" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <span aria-hidden className="collapsible-arrow">{open ? "▾" : "▸"}</span>{title}
      </button>
      <div id={id} hidden={!open} className="collapsible-body">{children}</div>
    </section>
  );
}
