import { redirect } from "next/navigation";
import Link from "next/link";
import { getAccess } from "@/lib/supabase/server";
import { searchCompanies } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Search({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const access = await getAccess();
  if (access.state !== "ok") redirect("/");
  const q = ((await searchParams).q ?? "").trim();
  if (!q) redirect("/");
  const data = await searchCompanies(q);
  if (data && data.length === 1) redirect(`/company/${data[0].ticker}`);
  return (
    <main className="narrow">
      <Link href="/" className="mono" style={{ fontSize: 12 }}>← Home</Link>
      <h1 style={{ marginTop: 12 }}>Results for “{q}”</h1>
      <div className="card">
        {!data?.length && <p className="muted mono" style={{ fontSize: 12, margin: 0 }}>No match yet. Only the mapped companies are loaded in this version. Type help for the commands.</p>}
        {data?.map((c) => (
          <Link key={c.ticker} href={`/company/${c.ticker}`} className="resrow"><span>{c.name}</span><span className="tag">{c.ticker}</span></Link>
        ))}
      </div>
    </main>
  );
}
