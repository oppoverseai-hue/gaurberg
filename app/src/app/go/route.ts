import { NextResponse } from "next/server";
import { getAccess } from "@/lib/supabase/server";
import { getIndex } from "@/lib/search";
import { pick } from "@/lib/search-core";

export const dynamic = "force-dynamic";

// Command bar (TRM-1, UX-1): "Uber", "UBER news", "Uber map", "help". A company name, ticker or alias plus an optional plain word.
// Matches every company in the graph (the search index). An unmapped company opens the map it sits on.
const SECTIONS: Record<string, string> = {
  chart: "chart", price: "price", numbers: "numbers", key: "numbers", about: "about", highlights: "highlights", financials: "highlights",
  fundamentals: "highlights", news: "news", links: "relationships", relationships: "relationships",
};
const MAP_WORDS = new Set(["map", "ecosystem"]);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const to = (path: string) => NextResponse.redirect(new URL(path, url));
  const access = await getAccess();
  if (access.state !== "ok") return to("/");
  const raw = (url.searchParams.get("q") ?? "").trim().replace(/\s+/g, " ");
  if (!raw) return to("/");
  const low = raw.toLowerCase();
  if (low === "help" || low === "?" || low === "commands") return to("/help");
  const words = raw.split(" ");
  const last = words.length > 1 ? words[words.length - 1].toLowerCase() : "";
  const isCmd = !!last && (last in SECTIONS || MAP_WORDS.has(last));
  const name = isCmd ? words.slice(0, -1).join(" ") : raw;
  const index = await getIndex(access.role).catch(() => null);
  const hit = index ? pick(index, name) : null;
  if (!hit) return to(`/search?q=${encodeURIComponent(name)}`);
  if (isCmd && MAP_WORDS.has(last)) return to(hit.mapHref);
  // Section words only apply to a company page; an unmapped company opens its map context.
  const companyPage = hit.mapped || !hit.context;
  return to(`${hit.href}${isCmd && companyPage ? `#${SECTIONS[last]}` : ""}`);
}
