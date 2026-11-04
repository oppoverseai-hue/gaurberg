import { NextResponse } from "next/server";
import { getAccess } from "@/lib/supabase/server";
import { getNews, offlineNews } from "@/lib/news";
import { isOffline } from "@/lib/mode";
import { getCompany } from "@/lib/data";

export const dynamic = "force-dynamic";

// One latest headline from the last 7 days for the link panel and the map preview (GRF-12). Only news that names the company
// (TRM-4): news and press releases first; filings only if there are none.
export async function GET(_: Request, { params }: { params: Promise<{ ticker: string }> }) {
  const access = await getAccess();
  if (access.state !== "ok") return NextResponse.json({ error: "not allowed" }, { status: 403 });
  const ticker = (await params).ticker.toUpperCase();
  const co = await getCompany(ticker);
  if (!co) return NextResponse.json({ item: null, note: "Company not found." });
  if (isOffline() && !process.env.DEV_NEWS_FIXTURE) return NextResponse.json({ item: null, note: "News is not saved for offline mode." });
  const { items, errors } = isOffline() ? offlineNews(co) : await getNews(co);
  const cutoff = Date.now() / 1000 - 7 * 86400;
  const recent = items.filter((i) => i.ts >= cutoff);
  const item = recent.find((i) => i.kind !== "filing") ?? recent[0] ?? null;
  return NextResponse.json({ item, note: item ? null : errors[0] ?? `No news naming ${co.name} in the last 7 days.` });
}
