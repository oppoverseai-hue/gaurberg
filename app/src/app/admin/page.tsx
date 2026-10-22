import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { getAccess, supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Admin screen (ACC-2, ACC-4): add or remove invited emails without a code change; see today's lookups and spend.
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

export default async function Admin() {
  const access = await getAccess();
  if (access.state !== "ok" || access.role !== "admin") redirect("/");
  const supabase = await supabaseServer();
  const day = new Date(); day.setUTCHours(0, 0, 0, 0);
  const [list, log] = await Promise.all([
    supabase.from("allowlist").select("email,role,created_at").order("created_at"),
    supabase.from("lookup_log").select("id,email,query,cost_usd,outcome,created_at").order("id", { ascending: false }).limit(30),
  ]);
  const rows = log.data ?? [];
  const today = rows.filter((r) => new Date(r.created_at) >= day);
  const spendToday = today.reduce((n, r) => n + Number(r.cost_usd ?? 0), 0);
  const spendAll = rows.reduce((n, r) => n + Number(r.cost_usd ?? 0), 0);
  return (
    <main className="narrow">
      <Link href="/" className="mono" style={{ fontSize: 12 }}>← Home</Link>
      <h1 style={{ marginTop: 12 }}>Admin</h1>

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
