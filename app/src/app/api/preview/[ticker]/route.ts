import { NextResponse } from "next/server";
import { getAccess } from "@/lib/supabase/server";
import { getCompany, getRels } from "@/lib/data";
import { getMarket } from "@/lib/market";

export const dynamic = "force-dynamic";

// Short version of the company page for the map preview pane (GRF-13). Reads the same data as the full page.
export async function GET(_: Request, { params }: { params: Promise<{ ticker: string }> }) {
  const access = await getAccess();
  if (access.state !== "ok") return NextResponse.json({ error: "not allowed" }, { status: 403 });
  const ticker = (await params).ticker.toUpperCase();
  const co = await getCompany(ticker);
  if (!co) return NextResponse.json({ error: "not found" }, { status: 404 });
  const [m, { rels }] = await Promise.all([getMarket(ticker), getRels(co.id)]);
  const counts = { suppliers: 0, customers: 0, partners: 0, rivals: 0 };
  for (const r of rels) {
    const other = r.source.id === co.id ? r.target : r.source;
    if (!other.is_seed) continue; // counts cover mapped companies only
    if (r.relationship_type === "competes") counts.rivals++;
    else if (r.relationship_type === "partners") counts.partners++;
    else if (r.relationship_type === "supplies") r.target.id === co.id ? counts.suppliers++ : counts.customers++;
    else if (r.relationship_type === "sells_to") r.source.id === co.id ? counts.customers++ : counts.suppliers++;
  }
  return NextResponse.json({
    company: { name: co.name, ticker: co.ticker, segment: co.segment, size_tier: co.size_tier },
    quote: m.quote, quoteError: m.quote ? null : m.quoteError, counts, about: m.profile?.description ?? null, news: null,
  });
}
