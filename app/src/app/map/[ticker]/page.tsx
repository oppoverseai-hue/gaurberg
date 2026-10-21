import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getAccess, supabaseServer } from "@/lib/supabase/server";
import type { Rel } from "@/lib/graph";
import MapView from "@/components/MapView";

export const dynamic = "force-dynamic";

const SEL = "id,relationship_type,exposure_pct,exposure_basis,exposure_qualifier,exposure_as_of,confidence,trust_status,source_type,status,as_of_date," +
  "source:companies!relationships_source_id_fkey(id,ticker,name,is_seed,entity_type),target:companies!relationships_target_id_fkey(id,ticker,name,is_seed,entity_type)," +
  "evidence(quote,document_url,section,published_at,quote_found)";

export default async function MapPage({ params }: { params: Promise<{ ticker: string }> }) {
  const access = await getAccess();
  if (access.state !== "ok") redirect("/");
  const ticker = (await params).ticker.toUpperCase();
  const supabase = await supabaseServer();
  const { data: focal } = await supabase.from("companies").select("id,ticker,name,is_seed,entity_type").eq("ticker", ticker).maybeSingle();
  if (!focal) notFound();
  // RLS decides what is visible: allowed users see promoted links only; the admin also sees staged links.
  const { data, error } = await supabase.from("relationships").select(SEL).or(`source_id.eq.${focal.id},target_id.eq.${focal.id}`);
  const rels = (data ?? []) as unknown as Rel[];
  return (
    <main className="wide">
      <div className="top"><Link href="/">← Search</Link><span className="muted">{access.email} ({access.role})</span></div>
      <h1>{focal.name} <span className="muted">({focal.ticker})</span> ecosystem</h1>
      {error ? (
        <div className="card"><p>Could not load links. <Link href={`/map/${ticker}`}>Retry</Link></p></div>
      ) : rels.length === 0 ? (
        <div className="card"><p>{focal.is_seed ? "No disclosed relationships found for this company." : "This company is not yet mapped."}</p></div>
      ) : (
        <MapView focal={focal} rels={rels} isAdmin={access.role === "admin"} />
      )}
    </main>
  );
}
