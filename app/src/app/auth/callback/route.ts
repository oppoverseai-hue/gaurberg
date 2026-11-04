import { NextResponse } from "next/server";
import { getAccess, supabaseServer } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  if (code) {
    const supabase = await supabaseServer();
    await supabase.auth.exchangeCodeForSession(code);
  }
  // A person who is not invited goes straight to the request form (ACC-5); everyone else to the home page.
  const access = await getAccess();
  return NextResponse.redirect(`${origin}${access.state === "not_invited" ? "/request-access" : "/"}`);
}
