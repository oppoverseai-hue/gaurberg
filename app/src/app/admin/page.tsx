import { redirect } from "next/navigation";
import Breadcrumbs from "@/components/Breadcrumbs";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { getAccess, supabaseServer } from "@/lib/supabase/server";
import { sendInvite } from "@/lib/mail";
import { firstName, ROLES, TOOLS } from "@/lib/waitlist-core";

export const dynamic = "force-dynamic";

// Admin screen (ACC-2, ACC-4, ACC-6): waitlist with Invite; add or remove invited emails without a code change; see today's lookups and spend.
// Row-level security decides who may change the list (admin only), so a reviewer who posts here changes nothing.
async function add(form: FormData) {
  "use server";
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const role = form.get("role") === "admin" ? "admin" : "reviewer";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return;
  const supabase = await supabaseServer();
  await supabase.from("allowlist").upsert({ email, role });
  revalidatePath("/admin");
}

async function remove(form: FormData) {
  "use server";
  const email = String(form.get("email") ?? "");
  const access = await getAccess();
  if (access.state !== "ok" || access.role !== "admin" || email.toLowerCase() === access.email.toLowerCase()) return; // never remove yourself
  const supabase = await supabaseServer();
  await supabase.from("allowlist").delete().eq("email", email);
  revalidatePath("/admin");
}

// Invite someone from the waitlist (ACC-6): add them to the allowlist as a reviewer, mark the row, send the invitation email.
async function invite(form: FormData) {
  "use server";
  const access = await getAccess();
  if (access.state !== "ok" || access.role !== "admin") return;
  const id = Number(form.get("id"));
  const supabase = await supabaseServer();
  const { data: w } = await supabase.from("waitlist").select("id,email,name,status").eq("id", id).maybeSingle();
  if (!w || w.status !== "waiting") return;
  const { error } = await supabase.from("allowlist").upsert({ email: w.email.toLowerCase(), role: "reviewer" });
  if (error) return;
  const now = new Date().toISOString();
  await supabase.from("waitlist").update({ status: "invited", invited_at: now }).eq("id", id);
  const sent = await sendInvite(w.email, firstName(w.name, w.email));
  if (sent.sent) await supabase.from("waitlist").update({ invite_sent_at: now }).eq("id", id);
  else console.error("[waitlist] invite not sent:", sent.reason);
  revalidatePath("/admin");
}

const label = (set: readonly (readonly [string, string])[], id: string) => set.find(([k]) => k === id)?.[1] ?? id;

export default async function Admin() {
  const access = await getAccess();
  if (access.state !== "ok" || access.role !== "admin") redirect("/");
  const supabase = await supabaseServer();
  const day = new Date(); day.setUTCHours(0, 0, 0, 0);
  const [list, log, refresh, wl] = await Promise.all([
    supabase.from("allowlist").select("email,role,created_at").order("created_at"),
    supabase.from("lookup_log").select("id,email,query,cost_usd,outcome,created_at").order("id", { ascending: false }).limit(30),
    supabase.from("agent_runs").select("id,status,target,finished_at").eq("agent_name", "market_refresh").order("id", { ascending: false }).limit(7),
    supabase.from("waitlist").select("id,email,name,role,tools,first_company,open_to_call,source,country,status,created_at,confirmation_sent_at,invite_sent_at").order("created_at", { ascending: false }).limit(200),
  ]);
  const runs = (refresh.data ?? []) as { id: number; status: string; target: string; finished_at: string | null }[];
  const lastOk = runs.find((r) => r.status !== "failed");
  const stale = !lastOk?.finished_at || Date.now() - Date.parse(lastOk.finished_at) > 36 * 3600e3;
  type W = { id: number; email: string; name: string | null; role: string; tools: string[]; first_company: string | null; open_to_call: boolean; source: Record<string, string>; country: string | null; status: string; created_at: string; confirmation_sent_at: string | null; invite_sent_at: string | null };
  const waiting = ((wl.data ?? []) as W[]);
  const rows = log.data ?? [];
  const today = rows.filter((r) => new Date(r.created_at) >= day);
  const spendToday = today.reduce((n, r) => n + Number(r.cost_usd ?? 0), 0);
  const spendAll = rows.reduce((n, r) => n + Number(r.cost_usd ?? 0), 0);
  return (
    <main className="narrow">
      <Breadcrumbs items={[{ label: "Admin" }]} />
      <h1 style={{ marginTop: 12 }}>Admin</h1>

      <div className="card">
        <div className="cardhead"><h3>Waitlist</h3><span className="tag">{waiting.filter((w) => w.status === "waiting").length} waiting · {waiting.filter((w) => w.open_to_call).length} open to a call</span></div>
        {wl.error && <p className="muted mono" style={{ fontSize: 12 }}>Could not load the waitlist: {wl.error.message}</p>}
        {!waiting.length && !wl.error && <p className="muted mono" style={{ fontSize: 12, margin: 0 }}>No requests yet.</p>}
        {waiting.map((w) => (
          <div key={w.id} className="resrow" style={{ alignItems: "flex-start" }}>
            <div>
              <strong>{w.name ?? w.email}</strong> <span className="muted">{w.email}</span> <span className="tag">{w.status}</span>{w.open_to_call && <> <span className="tag">open to a call</span></>}
              <div className="muted mono" style={{ fontSize: 11, marginTop: 4 }}>
                {label(ROLES, w.role)} · uses {w.tools.length ? w.tools.map((t) => label(TOOLS, t)).join(", ") : "not given"} · first company: {w.first_company ?? "not given"}
                <br />{new Date(w.created_at).toISOString().slice(0, 16).replace("T", " ")} UTC · {w.country ?? "country unknown"} · from {w.source?.utm_source ?? w.source?.ref ?? "direct"}{w.source?.utm_campaign ? ` / ${w.source.utm_campaign}` : ""} · confirmation {w.confirmation_sent_at ? "sent" : "not sent"}{w.status === "invited" ? ` · invite ${w.invite_sent_at ? "sent" : "not sent"}` : ""}
              </div>
            </div>
            {w.status === "waiting" && <form action={invite}><input type="hidden" name="id" value={w.id} /><button className="btn">Invite</button></form>}
          </div>
        ))}
      </div>

      <div className="card">
        <div className="cardhead"><h3>Invited emails</h3><span className="tag">{list.data?.length ?? 0}</span></div>
        {list.error && <p className="muted mono" style={{ fontSize: 12 }}>Could not load the list: {list.error.message}</p>}
        {list.data?.map((r) => (
          <div key={r.email} className="resrow">
            <span>{r.email} <span className="tag">{r.role}</span></span>
            {r.email.toLowerCase() !== access.email.toLowerCase() && (
              <form action={remove}><input type="hidden" name="email" value={r.email} /><button className="btn">Remove</button></form>
            )}
          </div>
        ))}
        <form action={add} style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <input type="email" name="email" placeholder="name@example.com" required style={{ flex: 1, minWidth: 220 }} />
          <select name="role" defaultValue="reviewer"><option value="reviewer">Reviewer</option><option value="admin">Admin</option></select>
          <button className="btn">Add</button>
        </form>
        <p className="muted mono" style={{ fontSize: 11, marginBottom: 0 }}>A change takes effect on the person&apos;s next page load. Reviewers read and run one live lookup a day; the admin has no limit.</p>
      </div>

      <div className="card">
        <div className="cardhead"><h3>Daily market data refresh</h3><span className="tag" style={stale ? { color: "var(--down)" } : undefined}>{stale ? "stale" : "fresh"}</span></div>
        <p style={{ margin: "0 0 8px" }}>{lastOk?.finished_at ? <>Last good run <b>{new Date(lastOk.finished_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Makassar" })}</b> Makassar.</> : "No successful run yet."} Runs daily at 19:00 Makassar (Vercel Cron).</p>
        {runs.map((r) => (
          <div key={r.id} className="resrow" style={{ display: "block" }}>
            <span className="tag" style={r.status === "failed" ? { color: "var(--down)" } : undefined}>{r.status}</span> <span className="muted mono" style={{ fontSize: 11 }}>{r.finished_at ? new Date(r.finished_at).toISOString().slice(0, 16).replace("T", " ") + " UTC" : ""} · {r.target}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="cardhead"><h3>Live lookups and spend</h3><Link href="/admin/queue" className="mono" style={{ fontSize: 12 }}>Queue →</Link></div>
        <p style={{ margin: "0 0 8px" }}>Today: <b>{today.filter((r) => r.outcome !== "refused").length}</b> lookups, spend <b>${spendToday.toFixed(2)}</b>. Daily cost cap: $0 (free model only). Last {rows.length} logged: ${spendAll.toFixed(2)}.</p>
        {!rows.length && <p className="muted mono" style={{ fontSize: 12, margin: 0 }}>No lookups logged yet.</p>}
        {rows.map((r) => (
          <div key={r.id} className="resrow" style={{ display: "block" }}>
            <strong>{r.query}</strong> <span className="tag">{r.outcome ?? "accepted"}</span> <span className="muted mono" style={{ fontSize: 11 }}>{r.email} · ${Number(r.cost_usd ?? 0).toFixed(2)} · {new Date(r.created_at).toISOString().slice(0, 16).replace("T", " ")} UTC</span>
          </div>
        ))}
      </div>
    </main>
  );
}
