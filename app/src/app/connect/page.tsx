import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccess } from "@/lib/supabase/server";
import { listCompanies, pickCompany, promotedRelsFor, type Pick } from "@/lib/connect";
import { findConnection, sourceLabel } from "@/lib/connect-core";
import { badgeOf, exposureText, TYPE_LABEL, type Co, type Rel } from "@/lib/graph";

export const dynamic = "force-dynamic";

const MAX_PATHS = 25;
const nameOf = (c: Co) => (c.ticker ? `${c.name} (${c.ticker})` : c.name);

// One link, in its own direction, with its type, source, quotes and page or section (GRF-16).
function LinkCard({ r }: { r: Rel }) {
  const b = badgeOf(r);
  const exp = exposureText(r);
  return (
    <div className="hop">
      <div className="hopline">
        <strong>{r.source.name}</strong> <span className="tag">{TYPE_LABEL[r.relationship_type]}</span> <strong>{r.target.name}</strong>
        <span className={`badge ${b.cls}`} style={{ marginLeft: 8 }}>{b.label}</span>
      </div>
      <p className="muted mono" style={{ fontSize: 11, margin: "4px 0 0" }}>
        Source: {sourceLabel(r)}{r.as_of_date ? ` · as of ${r.as_of_date}` : ""}{exp !== "Size not disclosed" ? ` · ${exp}` : ""}
      </p>
      {r.evidence.length === 0 ? <p className="muted mono" style={{ fontSize: 11 }}>No source quote saved for this link.</p> : r.evidence.slice(0, 2).map((e, i) => (
        <blockquote key={i}>
          “{e.quote}”
          <footer>
            {e.section ? `${/^p\d+$/.test(e.section) ? `page ${e.section.slice(1)}` : e.section.replace(/_/g, " ")} · ` : ""}
            {e.published_at ? `filed ${e.published_at} · ` : ""}
            {e.document_url ? <a href={e.document_url} target="_blank" rel="noreferrer">View source ↗</a> : "no document link saved"}
          </footer>
        </blockquote>
      ))}
      {r.evidence.length > 2 && (() => { const t = r.source.ticker ?? r.target.ticker; const n = r.evidence.length - 2; return <p className="muted mono" style={{ fontSize: 11, margin: "4px 0 0" }}>{n} more quote{n === 1 ? "" : "s"}{t ? <> on the <Link href={`/map/${t}`}>map</Link></> : " not shown"}.</p>; })()}
    </div>
  );
}

function PickField({ name, label, value, pick }: { name: string; label: string; value: string; pick: Pick }) {
  return (
    <label className="cpick">
      <span className="label">{label}</span>
      <input name={name} defaultValue={value} list="companies" placeholder="Company name or ticker" autoComplete="off" />
      {value && !pick.co && <span className="muted mono" style={{ fontSize: 11 }}>{pick.options.length ? `Did you mean: ${pick.options.map((o) => o.ticker ?? o.name).join(", ")}?` : "No company matches this."}</span>}
    </label>
  );
}

export default async function Connect({ searchParams }: { searchParams: Promise<{ a?: string; b?: string }> }) {
  const access = await getAccess();
  if (access.state !== "ok") redirect("/");
  const sp = await searchParams;
  const all = await listCompanies();
  const pa = pickCompany(sp.a, all), pb = pickCompany(sp.b, all);
  const a = pa.co, b = pb.co;
  const ready = !!a && !!b && a.id !== b.id;
  const data = ready ? await promotedRelsFor([a.id, b.id]) : null;
  const conn = ready && data ? findConnection(a.id, b.id, data.rels) : null;
  return (
    <main className="narrow connect">
      <Link href="/" className="mono" style={{ fontSize: 12 }}>← Home</Link>
      <h1 style={{ marginTop: 12 }}>Connection finder</h1>
      <p className="muted">Pick two companies to see how our sources connect them: a direct link, or a path through one shared company.</p>
      <form className="card cform" method="get" action="/connect">
        <PickField name="a" label="First company" value={sp.a ?? ""} pick={pa} />
        <PickField name="b" label="Second company" value={sp.b ?? ""} pick={pb} />
        <button type="submit" className="cta">Find connection</button>
        <datalist id="companies">{all.map((c) => <option key={c.id} value={c.ticker ?? c.name}>{c.ticker ? c.name : ""}</option>)}</datalist>
      </form>
      {a && b && a.id === b.id && <p className="muted">Pick two different companies.</p>}
      {ready && data?.error && <div className="card"><p>Could not load links. <Link href={`/connect?a=${encodeURIComponent(sp.a ?? "")}&b=${encodeURIComponent(sp.b ?? "")}`}>Retry</Link></p></div>}
      {ready && conn && !data?.error && (
        <section className="card">
          <div className="cardhead"><h3>{nameOf(a)} and {nameOf(b)}</h3></div>
          {conn.direct.length > 0 ? (
            <>
              <p className="label" style={{ margin: "0 0 8px" }}>Direct · {conn.direct.length} link{conn.direct.length === 1 ? "" : "s"}</p>
              {conn.direct.map((r) => <LinkCard key={r.id} r={r} />)}
            </>
          ) : conn.paths.length > 0 ? (
            <>
              <p className="label" style={{ margin: "0 0 8px" }}>No direct link · {conn.paths.length} indirect path{conn.paths.length === 1 ? "" : "s"}</p>
              {conn.paths.slice(0, MAX_PATHS).map((p) => (
                <div key={p.via.id} className="cpath">
                  <p className="hopline" style={{ margin: "0 0 6px" }}><span className="tag">indirect (via {p.via.name})</span></p>
                  <div className="hops">
                    <div>{p.first.map((r) => <LinkCard key={r.id} r={r} />)}</div>
                    <div>{p.second.map((r) => <LinkCard key={r.id} r={r} />)}</div>
                  </div>
                </div>
              ))}
              {conn.paths.length > MAX_PATHS && <p className="muted mono" style={{ fontSize: 11 }}>{conn.paths.length - MAX_PATHS} more paths not shown (best-documented first).</p>}
            </>
          ) : (
            <p style={{ margin: 0 }}>No documented connection in our sources.</p>
          )}
          <p className="muted mono" style={{ fontSize: 10, margin: "12px 0 0" }}>
            Promoted (reviewed) links only, up to two hops. A path through a shared company shows that both have a disclosed link with it, not that they deal with each other. This describes sources and is not a recommendation.
          </p>
        </section>
      )}
    </main>
  );
}
