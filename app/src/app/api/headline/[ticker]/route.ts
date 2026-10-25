import { NextResponse } from "next/server";
import { getAccess } from "@/lib/supabase/server";
import { getNews } from "@/lib/news";
import { isOffline } from "@/lib/mode";
import { getCompany } from "@/lib/data";

export const dynamic = "force-dynamic";

// One latest headline from the last 7 days for the link panel (GRF-12). News and press releases first; filings only if there are none.
export async function GET(_: Request, { params }: { params: Promise<{ ticker: string }> }) {
  const access = await getAccess();
  if (access.state !== "ok") return NextResponse.json({ error: "not allowed" }, { status: 403 });
  const ticker = (await params).ticker.toUpperCase();
  if (isOffline()) return NextResponse.json({ item: null, note: "News is not saved for offline mode." });
  const co = await getCompany(ticker);
  if (!co) return NextResponse.json({ item: null, note: "Company not found." });
  const { items, errors } = await getNews(co);
  const cutoff = Date.now() / 1000 - 7 * 86400;
  const recent = items.filter((i) => i.ts >= cutoff);
  const item = recent.find((i) => i.kind !== "filing") ?? recent[0] ?? null;
  return NextResponse.json({ item, note: item ? null : errors[0] ?? "No news in the last 7 days." });
}
