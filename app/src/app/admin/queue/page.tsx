import { redirect } from "next/navigation";
import Link from "next/link";
import { getAccess, supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Admin queue (LIV-E9): every live lookup, newest first. Queued ones wait for Claude Code (agents/live_lookup/process_queue.py).
export default async function Queue() {
  const access = await getAccess();
  if (access.state !== "ok" || access.role !== "admin") redirect("/");
  const supabase = await supabaseServer();
  const { data } = await supabase.from("lookup_queue").select("id,email,query,ticker,status,step,links_found,error,created_at,finished_at").order("id", { ascending: false }).limit(50);
  return (
    <main className="narrow">
      <Link href="/" className="mono" style={{ fontSize: 12 }}>← Home</Link>
      <h1 style={{ marginTop: 12 }}>Live lookups</h1>
      <div className="card">
        {!data?.length && <p className="muted mono" style={{ fontSize: 12, margin: 0 }}>No lookups yet.</p>}
        {data?.map((r) => (
          <div key={r.id} className="resrow" style={{ display: "block" }}>
            <span className="tag">{r.status}</span> <strong>{r.ticker ?? r.query}</strong> <span className="muted mono" style={{ fontSize: 11 }}>{r.email} · {new Date(r.created_at).toISOString().slice(0, 16).replace("T", " ")} UTC</span>
            <div className="muted mono" style={{ fontSize: 11 }}>{r.step}{r.links_found != null ? ` · ${r.links_found} links` : ""}{r.error ? ` · ${r.error}` : ""}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
