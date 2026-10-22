"use client";
// Account menu in the top bar: initial in a circle, dropdown with the email, role, Admin link (admins) and Sign out.
import { useEffect, useRef, useState } from "react";

export default function AccountMenu({ email, role }: { email: string; role: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const away = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, []);
  return (
    <div className="acct" ref={ref}>
      <button type="button" className="acct-btn" aria-label="Account menu" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{email.charAt(0).toUpperCase()}</button>
      {open && (
        <div className="acct-pop" role="menu">
          <div className="acct-who"><span>{email}</span><small>{role}</small></div>
          {role === "admin" && <a href="/admin" role="menuitem">Admin</a>}
          <form action="/auth/signout" method="post"><button role="menuitem">Sign out</button></form>
        </div>
      )}
    </div>
  );
}
