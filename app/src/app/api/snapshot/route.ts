import { NextResponse } from "next/server";
import { getAccess, supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Offline snapshot export (DEM-1). Admin only. Downloads data/snapshot.json in the shape the offline mode reads:
// every company, and promoted or live links with their evidence. Staged and rejected links are never included.
// Save the download as app/data/snapshot.json.
export async function GET() {
  const access = await getAccess();
  if (access.state !== "ok" || access.role !== "admin") return NextResponse.json({ error: "admin only" }, { status: 403 });
  const supabase = await supabaseServer();
  const [c, r] = await Promise.all([
    supabase.from("companies").select("id,name,ticker,is_seed,segment,size_tier,entity_type,markets").order("id").limit(5000),
    supabase.from("relationships")
      .select("id,status,source_id,target_id,as_of_date,confidence,source_type,exposure_pct,trust_status,exposure_as_of,exposure_basis,relationship_type,exposure_qualifier,note,evidence(quote,section,quote_found,document_url,published_at)")
      .in("status", ["promoted", "live"]).order("id").limit(5000),
  ]);
  if (c.error || r.error) return NextResponse.json({ error: (c.error ?? r.error)!.message }, { status: 500 });
  const rels = (r.data ?? []).map((x) => (x.note ? x : (({ note, ...rest }) => (void note, rest))(x)));
  const body = JSON.stringify({ generated_at: new Date().toISOString().slice(0, 10), companies: c.data, rels });
  return new NextResponse(body, { headers: { "content-type": "application/json", "content-disposition": 'attachment; filename="snapshot.json"' } });
}
