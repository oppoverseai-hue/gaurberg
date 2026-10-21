"use client";
// Live lookup panel (J5: LIV-1, LIV-2, UX-5). Starts a first-ring lookup for a company that is not mapped, shows the current step by name,
// and never blocks the rest of the app: the page stays usable while it polls.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

type Res = { state: string; id?: number; ticker?: string; name?: string; step?: string; message?: string; links_found?: number; error?: string };

export default function LiveLookup({ query }: { query: string }) {
  const router = useRouter();
  const [res, setRes] = useState<Res | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const call = async (body: object): Promise<Res> => {
    const { data, error } = await supabaseBrowser().functions.invoke("live-lookup", { body });
    if (error && !data) {
      const ctx = (error as { context?: Response }).context;
      try { return await ctx!.json(); } catch { return { state: "error", message: "The lookup service could not be reached." }; }
    }
    return data as Res;
  };
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  const start = async () => {
    setBusy(true);
    const r = await call({ action: "start", query });
    setRes(r);
    if (r.state === "cached" && r.ticker) { router.push(`/map/${r.ticker}`); return; }
    if (r.state === "running" && r.id) {
      timer.current = setInterval(async () => {
        const s = await call({ action: "status", id: r.id });
        setRes({ ...s, ticker: r.ticker, name: r.name });
        if (s.state !== "running") { if (timer.current) clearInterval(timer.current); setBusy(false); if (s.state === "done" && (s.links_found ?? 0) > 0) router.push(`/map/${r.ticker}`); }
      }, 2000);
    } else setBusy(false);
  };
  const msg = !res ? null
    : res.state === "running" ? `Still running: ${res.step ?? "starting"}…`
    : res.state === "queued" ? "Queued. No free model is available right now. It will be researched later and appear here."
    : res.state === "done" ? ((res.links_found ?? 0) > 0 ? "Done. Opening the map…" : "No disclosed relationships found.")
    : res.state === "failed" ? "The lookup failed and was logged. Try again later."
    : res.message ?? "Something went wrong.";
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <p style={{ margin: "0 0 8px" }}>Not one of the mapped companies. Research “{query}” from its latest annual report?</p>
      <p className="muted mono" style={{ fontSize: 11, margin: "0 0 12px" }}>Results are labeled Live-generated, not reviewed. One lookup per person per day.</p>
      <button className="linkchip" onClick={start} disabled={busy} style={{ cursor: busy ? "wait" : "pointer" }}>{busy ? "Researching…" : "Look it up live"}</button>
      {msg && <p className="mono" style={{ fontSize: 12, marginTop: 12 }} role="status">{msg}</p>}
    </div>
  );
}
