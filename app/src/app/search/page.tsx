import { redirect } from "next/navigation";
import Breadcrumbs from "@/components/Breadcrumbs";
import Link from "next/link";
import { getAccess } from "@/lib/supabase/server";
import { getIndex } from "@/lib/search";
import { search } from "@/lib/search-core";
import { isOffline } from "@/lib/mode";
import LiveLookup from "@/components/LiveLookup";

export const dynamic = "force-dynamic";

export default async function Search({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const access = await getAccess();
  if (access.state !== "ok") redirect("/");
  const q = ((await searchParams).q ?? "").trim();
  if (!q) redirect("/");
  const index = await getIndex(access.role).catch(() => null);
  const data = index ? search(index, q, 20) : null;
  if (data && data.length === 1) redirect(data[0].href);
  return (
    <main className="narrow">
      <Breadcrumbs items={[{ label: "Search" }]} />
      <h1 style={{ marginTop: 12 }}>Results for “{q}”</h1>
      <div className="card">
        {!index && <p className="muted mono" style={{ fontSize: 12, margin: 0 }}>Search is not available right now. <Link href={`/search?q=${encodeURIComponent(q)}`}>Retry</Link></p>}
        {index && !data?.length && <p className="muted mono" style={{ fontSize: 12, margin: 0 }}>No company in the graph matches. Type help for the commands.</p>}
        {data?.map((c) => (
          <Link key={c.id} href={c.href} className="resrow">
            <span>{c.name}{c.alias && <span className="muted"> · also “{c.alias}”</span>}{!c.mapped && c.context && <span className="muted"> · on the {c.context.ticker} map</span>}</span>
            {c.ticker ? <span className="tag">{c.ticker}</span> : <span className="tag">no ticker</span>}
          </Link>
        ))}
      </div>
      {index && !data?.length && (isOffline() ? <p className="muted mono" style={{ fontSize: 12 }}>Live lookup needs the network and is off in the offline demo.</p> : <LiveLookup query={q} />)}
    </main>
  );
}
