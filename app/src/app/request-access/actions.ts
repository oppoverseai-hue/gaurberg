"use server";
// Request-access form action (ACC-5, ACC-6). Saves the waitlist row as the signed-in person (row-level security checks the
// user and email), then sends the confirmation email after the response so the button never waits on Gmail.
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendWaitlistConfirmation } from "@/lib/mail";
import { checkForm, firstName, parseSource } from "@/lib/waitlist-core";

export type JoinState = { error: string | null };

export async function join(_prev: JoinState, form: FormData): Promise<JoinState> {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  const user = u.user;
  if (!user?.email) redirect("/");
  const c = checkForm(form);
  if (!c.ok) return { error: c.error };
  const name = (user.user_metadata?.full_name ?? user.user_metadata?.name ?? null) as string | null;
  const country = (await headers()).get("x-vercel-ip-country")?.slice(0, 2) ?? null;
  const source = parseSource((await cookies()).get("gb_src")?.value);
  const { error } = await supabase.from("waitlist").insert({ user_id: user.id, email: user.email.toLowerCase(), name, ...c.value, source, country });
  if (error && error.code !== "23505") return { error: "Could not save your request. Please try again." }; // 23505: already on the list
  if (!error) {
    const to = user.email, first = firstName(name, user.email), id = user.id;
    after(async () => {
      const sent = await sendWaitlistConfirmation(to, first);
      if (sent.sent) await supabaseAdmin()?.from("waitlist").update({ confirmation_sent_at: new Date().toISOString() }).eq("user_id", id);
      else console.error("[waitlist] confirmation not sent:", sent.reason);
    });
  }
  redirect("/request-access"); // fresh render of the page, which now shows the confirmation
}
