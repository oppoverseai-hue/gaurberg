// Request-access form and confirmation (ACC-5, ACC-6), shown on the home page to a person who signed in with Google
// but is not on the invite list. Interim layout in the app's own style; the Stitch design replaces the look, not the fields.
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendWaitlistConfirmation } from "@/lib/mail";
import { checkForm, firstName, parseSource, ROLES, TOOLS } from "@/lib/waitlist-core";

async function join(form: FormData) {
  "use server";
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  const user = u.user;
  if (!user?.email) return;
  const c = checkForm(form);
  const store = await cookies();
  if (!c.ok) { store.set("gb_wl_err", c.error, { maxAge: 60, path: "/" }); revalidatePath("/"); return; }
  const name = (user.user_metadata?.full_name ?? user.user_metadata?.name ?? null) as string | null;
  const country = (await headers()).get("x-vercel-ip-country")?.slice(0, 2) ?? null;
  const { error } = await supabase.from("waitlist").insert({
    user_id: user.id, email: user.email.toLowerCase(), name, ...c.value, source: parseSource(store.get("gb_src")?.value), country,
  });
  if (error && error.code !== "23505") { store.set("gb_wl_err", "Could not save your request. Please try again.", { maxAge: 60, path: "/" }); revalidatePath("/"); return; }
  if (!error) {
    const sent = await sendWaitlistConfirmation(user.email, firstName(name, user.email));
    if (sent.sent) await supabaseAdmin()?.from("waitlist").update({ confirmation_sent_at: new Date().toISOString() }).eq("user_id", user.id);
    else console.error("[waitlist] confirmation not sent:", sent.reason);
  }
  store.delete("gb_wl_err");
  revalidatePath("/");
}

export default async function RequestAccess({ email }: { email: string }) {
  const supabase = await supabaseServer();
  const [{ data: u }, { data: row }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("waitlist").select("status,created_at").maybeSingle(),
  ]);
  const name = (u.user?.user_metadata?.full_name ?? u.user?.user_metadata?.name ?? null) as string | null;
  const first = firstName(name, email);
  const err = (await cookies()).get("gb_wl_err")?.value;

  if (row) return (
    <div className="card">
      <p className="label" style={{ margin: 0 }}>Early access</p>
      <h2 style={{ marginTop: 8 }}>You&apos;re on the list, {first}.</h2>
      <p>We&apos;ve emailed {email}. Invitations go out in small batches; you&apos;ll get a second email when yours is ready.</p>
      <form action="/auth/signout" method="post"><button className="btn">Sign out</button></form>
    </div>
  );

  return (
    <form action={join} className="card wl">
      <p className="label" style={{ margin: 0 }}>Early access</p>
      <h2 style={{ marginTop: 8 }}>You&apos;re almost in, {first}.</h2>
      <p className="muted mono" style={{ fontSize: 12 }}>{name ? `${name} · ` : ""}{email} · <button type="submit" formAction="/auth/signout" formMethod="post" formNoValidate className="linkbtn">Not you? Switch account</button></p>
      <fieldset><legend>Which best describes you?</legend>
        <div className="chips">{ROLES.map(([id, label]) => <label key={id} className="chip"><input type="radio" name="role" value={id} required /> {label}</label>)}</div>
      </fieldset>
      <fieldset><legend>What do you use today for company research? <span className="muted">(pick any)</span></legend>
        <div className="chips">{TOOLS.map(([id, label]) => <label key={id} className="chip"><input type="checkbox" name="tools" value={id} /> {label}</label>)}</div>
      </fieldset>
      <label className="wl-field">Which company should we map for you first?
        <input type="text" name="first_company" maxLength={120} placeholder="e.g. Apple or Rheinmetall" />
      </label>
      <label className="wl-check"><input type="checkbox" name="open_to_call" /> I&apos;m open to a 15-minute call about what I&apos;d use this for</label>
      <label className="wl-check"><input type="checkbox" name="consent_updates" required /> Email me about my invitation and product updates</label>
      {err && <p role="alert" style={{ color: "var(--down)" }}>{err}</p>}
      <button className="btn" style={{ marginTop: 8 }}>Request my invitation</button>
      <p className="muted mono" style={{ fontSize: 11, marginBottom: 0 }}>We keep your name, email and answers to manage early access. Reply to any of our emails to be removed.</p>
    </form>
  );
}
