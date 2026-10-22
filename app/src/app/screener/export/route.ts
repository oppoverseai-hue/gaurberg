import { NextResponse } from "next/server";
import { getAccess } from "@/lib/supabase/server";
import { loadRows, parseFilters, toCsv } from "@/lib/screener";

export const dynamic = "force-dynamic";

// CSV of the current screen (same filters and order as the page).
export async function GET(req: Request) {
  const access = await getAccess();
  if (access.state !== "ok") return NextResponse.json({ error: "not allowed" }, { status: 403 });
  const f = parseFilters(Object.fromEntries(new URL(req.url).searchParams));
  const { rows } = await loadRows(f);
  return new NextResponse(toCsv(rows), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="gaurberg-screen.csv"' } });
}
