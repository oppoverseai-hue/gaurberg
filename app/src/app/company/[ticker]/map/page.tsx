import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import Link from "next/link";
import { getAccess, supabaseServer } from "@/lib/supabase/server";
import { renderTimer } from "@/lib/render-timing";
import { getCompany, getRels, getGeo, recordView } from "@/lib/data";
import type { Rel } from "@/lib/graph";
import MapView from "@/components/MapView";
import LiveLookup from "@/components/LiveLookup";
import { isOffline } from "@/lib/mode";
import { getComove } from "@/lib/comove";

export const dynamic = "force-dynamic";

// ?focus=<company id> opens the map with that company selected (TRM-1: search results for unmapped companies land here).
export default async function MapPage({ params, searchParams }: { params: Promise<{ ticker: string }>; searchParams: Promise<{ focus?: string }> }) {
  const t = renderTimer("map");
  const ticker = (await params).ticker.toUpperCase();
  const focusId = Number((await searchParams).focus) || undefined;
  // NFR-1: the sign-in check, the allowlist and the company lookup at once (the company read is under RLS; the role is still checked
  // before anything renders).
  const [access, focal] = t.step("access+company", await Promise.all([getAccess(), getCompany(ticker)]));
  if (access.state !== "ok") redirect("/");
  if (!focal) notFound();
  // The "viewed" row is written after the page is sent: it never delays the page, and a failure never blocks it.
  const db = await supabaseServer();
  after(() => recordView(db, focal.id));
  // RLS decides what is visible online: allowed users see promoted links only; the admin also sees staged links. Offline shows the saved promoted links.
  const { rels, error: relError } = t.step("links", await getRels(focal.id));
  const error = relError;
  const [{ geo, countryRegion }, comove] = await Promise.all([
    getGeo([...new Set([focal.id, ...rels.flatMap((r) => [r.source.id, r.target.id])])]),
    error ? Promise.resolve({}) : getComove(focal.id, rels),
  ]);
  t.step("prices");
  t.done(ticker);
  return (
    <main className="wide">
      {error ? (
        <div className="card" style={{ margin: 24 }}><p>Could not load links. <Link href={`/company/${ticker}/map`}>Retry</Link></p></div>
      ) : rels.length === 0 ? (
        <div style={{ margin: 24 }}>
          <div className="card"><p>{focal.is_seed ? "No disclosed relationships found for this company." : "This company is not yet mapped."}</p></div>
          {!focal.is_seed && (isOffline() ? <p className="muted mono" style={{ fontSize: 12 }}>Live lookup needs the network and is off in the offline demo.</p> : <LiveLookup query={focal.ticker ?? focal.name} />)}
        </div>
      ) : (
        <MapView focal={focal} rels={rels} isAdmin={access.role === "admin"} geo={geo} countryRegion={countryRegion} comove={comove} focusId={focusId} />
      )}
    </main>
  );
}
