import { NextResponse } from "next/server";
import { getAccess } from "@/lib/supabase/server";
import { resolveNewsUrl } from "@/lib/news";
import { isFinnhubNewsUrl, fallbackSearchUrl } from "@/lib/news-link";

export const dynamic = "force-dynamic";

// News link redirect (TRM-7). The data service's own news links redirect to the publisher and can hang in the browser.
// The server follows that redirect once and sends the reader on. If it cannot, the reader gets a web search for the headline instead of a spinner.
export async function GET(req: Request) {
  const access = await getAccess();
  if (access.state !== "ok") return NextResponse.redirect(new URL("/", req.url));
  const q = new URL(req.url).searchParams;
  const u = q.get("u") ?? "";
  if (!isFinnhubNewsUrl(u)) return NextResponse.json({ error: "not a news link" }, { status: 400 });
  const target = await resolveNewsUrl(u);
  return NextResponse.redirect(target ?? fallbackSearchUrl(q.get("h") ?? "", q.get("s") ?? ""), 302);
}
