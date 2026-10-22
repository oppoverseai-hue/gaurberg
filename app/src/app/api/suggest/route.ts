import { NextResponse } from "next/server";
import { getAccess } from "@/lib/supabase/server";
import { suggest } from "@/lib/suggest";

export const dynamic = "force-dynamic";

// Type-ahead for the landing search. Signed-in, invited users only. No q returns the best-connected companies.
export async function GET(req: Request) {
  const access = await getAccess();
  if (access.state !== "ok") return NextResponse.json({ error: "not allowed" }, { status: 403 });
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return NextResponse.json({ items: await suggest(q) });
}
