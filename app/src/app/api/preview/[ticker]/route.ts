import { NextResponse } from "next/server";
import { getAccess, supabaseServer } from "@/lib/supabase/server";
import { getQuote } from "@/lib/finnhub";

export const dynamic = "force-dynamic";

// Short version of the company page for the map preview pane (GRF-13). Reads the same data as the full page.
export async function GET(_: Request, { params }: { params: Promise<{ ticker: string }> }) {
  const access = await getAccess();
  if (access.state !== "ok") return NextResponse.json({ error: "not allowed" }, { status: 403 });
  const ticker = (await params).ticker.toUpperCase();
  const supabase = await supabaseServer();
  const { data: co } = await supabase.from("companies").select("id,ticker,name,segment,size_tier").eq("ticker", ticker).maybeSingle();
  if (!co) return NextResponse.json({ error: "not found" }, { status: 404 });
  const [q, rels] = await Promise.all([
    getQuote(ticker),
    supabase.from("relationships").select("relationship_type,source_id,target_id,source:companies!relationships_source_id_fkey(is_seed),target:companies!relationships_target_id_fkey(is_seed)")
      .or(`source_id.eq.${co.id},target_id.eq.${co.id}`),
  ]);
  const counts = { suppliers: 0, customers: 0, partners: 0, rivals: 0 };
  for (const r of (rels.data ?? []) as unknown as { relationship_type: string; source_id: number; target_id: number; source: { is_seed: boolean }; target: { is_seed: boolean } }[]) {
    const other = r.source_id === co.id ? r.target : r.source;
    if (!other?.is_seed) continue; // counts cover mapped companies only
    if (r.relationship_type === "competes") counts.rivals++;
    else if (r.relationship_type === "partners") counts.partners++;
    else if (r.relationship_type === "supplies") r.target_id === co.id ? counts.suppliers++ : counts.customers++;
    else if (r.relationship_type === "sells_to") r.source_id === co.id ? counts.customers++ : counts.suppliers++;
  }
  return NextResponse.json({ company: co, quote: q.ok ? q.quote : null, quoteError: q.ok ? null : q.reason, counts, about: null, news: null });
}
