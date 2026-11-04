"use client";
// Remembers where a visitor first came from (UTM tags, referring site, landing path) in a first-party cookie for 30 days,
// so a later waitlist request can record the channel (ACC-5). Set once; never overwritten; no third-party script.
import { useEffect } from "react";

export default function SourceCapture() {
  useEffect(() => {
    try {
      if (document.cookie.split("; ").some((c) => c.startsWith("gb_src="))) return;
      const u = new URL(window.location.href), out: Record<string, string> = {};
      for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) { const v = u.searchParams.get(k); if (v) out[k] = v.slice(0, 200); }
      const ref = document.referrer ? new URL(document.referrer).hostname : "";
      if (ref && ref !== u.hostname) out.ref = ref;
      out.path = u.pathname;
      document.cookie = `gb_src=${encodeURIComponent(JSON.stringify(out))}; Max-Age=${30 * 86400}; Path=/; SameSite=Lax; Secure`;
    } catch { /* ignore */ }
  }, []);
  return null;
}
