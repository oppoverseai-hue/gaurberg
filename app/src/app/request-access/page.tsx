// Request-access page (ACC-5, ACC-6). Google sign-in brings a person who is not invited straight here: the form first,
// then the confirmation once they have joined. Invited people go to the app; signed-out visitors go to the landing page.
import "@/components/landing/landing.css";
import "./request.css";
import { redirect } from "next/navigation";
import { getAccess, supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { firstName } from "@/lib/waitlist-core";
import Logo from "@/components/Logo";
import RequestForm from "./RequestForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Request an invitation · Gaurberg" };

export default async function RequestAccessPage() {
  const access = await getAccess();
  if (access.state === "signed_out") redirect("/#access");
  if (access.state === "ok") redirect("/");
  const supabase = await supabaseServer();
  const [{ data: u }, { data: row }] = await Promise.all([supabase.auth.getUser(), supabase.from("waitlist").select("id,status,created_at").maybeSingle()]);
  const name = (u.user?.user_metadata?.full_name ?? u.user?.user_metadata?.name ?? null) as string | null;
  const first = firstName(name, access.email);
  // Place in line: how many requests were made up to and including this one (a real count, never rounded or padded).
  let place: number | null = null;
  if (row) { const { count } = (await supabaseAdmin()?.from("waitlist").select("id", { count: "exact", head: true }).lte("id", (row as { id: number }).id)) ?? {}; place = count ?? null; }

  return (
    <div className="paper">
      <header className="rq-top">
        <a href="/" aria-label="Gaurberg home"><Logo /></a>
        <form action="/auth/signout" method="post"><button className="rq-link">Sign out</button></form>
      </header>
      <main className="rq-wrap">
        <div className="rq-card">
          {row ? (
            <>
              <p className="pp-mono rq-over">Request received</p>
              <h1>{place ? <>You&apos;re <span className="pp-em">#{place.toLocaleString("en-US")}</span> on the list, {first}.</> : <>You&apos;re on the list, {first}.</>}</h1>
              <p className="rq-lede">We&apos;ll email <b>{access.email}</b> as soon as your invitation is ready. Then sign in with this Google account and you&apos;re in.</p>
              <p className="rq-small">A confirmation is on its way now. Invitations go out a few at a time, because every link in Gaurberg is still checked by hand.</p>
              <p className="rq-fine"><a href="/#features">See what Gaurberg does</a></p>
            </>
          ) : (
            <>
              <p className="pp-mono rq-over">Request an invitation</p>
              <h1>You&apos;re almost in, {first}.</h1>
              <p className="rq-who">Signed in as {name ? `${name} · ` : ""}{access.email}</p>
              <RequestForm />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
