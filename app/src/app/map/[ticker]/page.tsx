import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getAccess } from "@/lib/supabase/server";
import { getCompany, getRels, getGeo, recordView } from "@/lib/data";
import type { Rel } from "@/lib/graph";
import MapView from "@/components/MapView";
import LiveLookup from "@/components/LiveLookup";
import { isOffline } from "@/lib/mode";

export const dynamic = "force-dynamic";

export default async function MapPage({ params }: { params: Promise<{ ticker: string }> }) {
  const access = await getAccess();
  if (access.state !== "ok") redirect("/");
  const ticker = (await params).ticker.toUpperCase();
  const focal = await getCompany(ticker);
  if (!focal) notFound();
  await recordView(focal.id);
  // RLS decides what is visible online: allowed users see promoted links only; the admin also sees staged links. Offline shows the saved promoted links.
  const { rels, error: relError } = await getRels(focal.id);
  const error = relError;
  const { geo, countryRegion } = await getGeo([...new Set([focal.id, ...rels.flatMap((r) => [r.source.id, r.target.id])])]);
  return (
    <main className="wide">
      {error ? (
        <div className="card" style={{ margin: 24 }}><p>Could not load links. <Link href={`/map/${ticker}`}>Retry</Link></p></div>
      ) : rels.length === 0 ? (
        <div style={{ margin: 24 }}>
          <div className="card"><p>{focal.is_seed ? "No disclosed relationships found for this company." : "This company is not yet mapped."}</p></div>
          {!focal.is_seed && (isOffline() ? <p className="muted mono" style={{ fontSize: 12 }}>Live lookup needs the network and is off in the offline demo.</p> : <LiveLookup query={focal.ticker ?? focal.name} />)}
        </div>
      ) : (
        <MapView focal={focal} rels={rels} isAdmin={access.role === "admin"} geo={geo} countryRegion={countryRegion} />
      )}
    </main>
  );
}
