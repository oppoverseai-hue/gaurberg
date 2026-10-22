import { NextResponse } from "next/server";
import { getAccess } from "@/lib/supabase/server";
import { getIndices } from "@/lib/indices";
import { isOffline } from "@/lib/mode";

export const dynamic = "force-dynamic";

// Index ticker data. ?probe=1 (admin only) shows which provider and symbol answered, so the data source can be confirmed.
export async function GET(req: Request) {
  const access = await getAccess();
  if (access.state !== "ok") return NextResponse.json({ error: "not allowed" }, { status: 403 });
  if (isOffline()) return NextResponse.json({ items: [], note: "Index prices are not saved for offline mode." });
  const { items, probes } = await getIndices();
  const probe = new URL(req.url).searchParams.get("probe") === "1" && access.role === "admin";
  return NextResponse.json(probe ? { items, probes } : { items });
}
