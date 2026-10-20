import { redirect } from "next/navigation";
import Link from "next/link";
import { getAccess, supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Search({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const access = await getAccess();
  if (access.state !== "ok") redirect("/");
  const q = ((await searchParams).q ?? "").trim();
  if (!q) redirect("/");
  const supabase = await supabaseServer();
  const safe = q.replace(/[%,()]/g, "");
  const { data } = await supabase
    .from("companies")
    .select("ticker,name")
    .or(`ticker.ilike.${safe},name.ilike.%${safe}%`)
    .limit(10);
  if (data && data.length === 1) redirect(`/company/${data[0].ticker}`);
  return (
    <main>
      <Link href="/">← Back</Link>
      <h1>Results for “{q}”</h1>
      {!data?.length && <p className="muted">No match yet. Only the seed companies are loaded in this prototype.</p>}
      <ul>
        {data?.map((c) => (
          <li key={c.ticker}><Link href={`/company/${c.ticker}`}>{c.name} ({c.ticker})</Link></li>
        ))}
      </ul>
    </main>
  );
}
