import { NextResponse } from "next/server";
import { getAccess } from "@/lib/supabase/server";
import { getIndex } from "@/lib/search";

export const dynamic = "force-dynamic";

// The whole search index in one response (TRM-1), so the landing search can match each keystroke in the browser.
// Signed-in, invited users only; the browser may keep it for 5 minutes.
export async function GET() {
  const access = await getAccess();
  if (access.state !== "ok") return NextResponse.json({ error: "not allowed" }, { status: 403 });
  try {
    const items = await getIndex(access.role);
    return NextResponse.json({ items }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch {
    return NextResponse.json({ error: "Search is not available right now." }, { status: 503 });
  }
}
