import { redirect } from "next/navigation";
import Link from "next/link";
import { getAccess, supabaseServer } from "@/lib/supabase/server";
import reqData from "../../../data/requirements.json";
import milestones from "../../../data/milestones.json";
import superseded from "../../../data/superseded.json";

export const dynamic = "force-dynamic";

type T = { test_id: string; run_id: number | null; metric: string; value: number | null; threshold: number | null; passed: boolean | null; created_at: string };
type A = { agent_name: string; mode: string; runs: number; last_run: string; last_model: string | null; cost_usd: number | null };
type S = { ticker: string; name: string; real_links: number; sample_links: number };
const day = (s: string) => new Date(s).toISOString().slice(0, 10);

// Latest result per test: the newest row for each saved run (run_id). A test passes only if every one of those latest rows passed.
// A failure whose run later passed is not listed (PRC-2). A test with no rows is "Not run", never a pass (APP-14).
function latest(rows: T[]) {
  // Failures the admin has marked superseded are set aside and shown separately, never counted as passes.
  rows = rows.filter((r) => !superseded.some((x) => x.test_id === r.test_id && x.run_id === r.run_id));
  const per = new Map<string, Map<string, T>>();
  for (const r of rows) {
    const m = per.get(r.test_id) ?? new Map<string, T>();
    const k = String(r.run_id ?? r.metric);
    const cur = m.get(k);
    if (!cur || r.created_at > cur.created_at) m.set(k, r);
    per.set(r.test_id, m);
  }
  const out = new Map<string, { status: "pass" | "fail"; date: string; fails: T[]; n: number }>();
  for (const [id, m] of per) {
    const l = [...m.values()];
    const fails = l.filter((x) => x.passed === false);
    out.set(id, { status: fails.length ? "fail" : "pass", date: day(l.map((x) => x.created_at).sort().at(-1)!), fails, n: l.length });
  }
  return out;
}

const col = { pass: "var(--ok, #34d399)", fail: "var(--bad, #f87171)", none: "var(--muted)" };

export default async function Hood() {
  const access = await getAccess();
  if (access.state !== "ok") redirect("/");
  const isAdmin = access.role === "admin";
  const supabase = await supabaseServer();
  const [t, a, s] = await Promise.all([supabase.rpc("hood_tests"), supabase.rpc("hood_agents"), supabase.rpc("hood_source_share")]);
  const failedLoad = !!(t.error || a.error || s.error);
  const res = latest((t.data ?? []) as T[]);
  const agents = (a.data ?? []) as A[];
  const share = ((s.data ?? []) as S[]).sort((x, y) => x.name.localeCompare(y.name));

  const seen = new Set<string>();
  const reqs = (reqData.requirements as { id: string; what: string; priority: string; job: string }[]).filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
  const prio: Record<string, string> = { M: "Must", S: "Should", C: "Could" };
  const jobs = [...new Set(reqs.map((r) => r.job))].sort((x, y) => Number(x.slice(1)) - Number(y.slice(1)));
  const failing = [...res.entries()].filter(([, v]) => v.status === "fail");
  const testIds = [...res.keys()].sort();
  const costTotal = agents.reduce((n, x) => n + (x.cost_usd ?? 0), 0);

  return (
    <main className="narrow" style={{ maxWidth: 1000 }}>
      <Link href="/" className="mono" style={{ fontSize: 12 }}>← Home</Link>
      <h1 style={{ marginTop: 12 }}>Under the hood</h1>
      <p className="muted">How the information is collected, structured and tested. Every result below is read from a stored test or run record.</p>
      {failedLoad && <div className="card"><p style={{ margin: 0 }}>Could not load the stored test results right now. Nothing is shown as passed.</p></div>}

      <div className="card" id="requirements">
        <div className="cardhead"><h3>1 · What we set out to build</h3><span className="tag">{reqs.length} requirements</span></div>
        {jobs.map((j) => {
          const list = reqs.filter((r) => r.job === j);
          return (
            <div key={j} style={{ marginTop: 10 }}>
              <div className="mono" style={{ fontSize: 12, color: "var(--fg2)" }}>{j}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                {list.map((r) => {
                  const v = res.get(r.id);
                  return (
                    <a key={r.id} href={`#t-${r.id}`} className="tag" title={`${prio[r.priority]}: ${r.what}`} style={{ borderColor: v ? col[v.status] : undefined, opacity: r.priority === "M" ? 1 : 0.7 }}>
                      {r.id} <span style={{ color: "var(--muted)" }}>{r.priority}</span>
                    </a>
                  );
                })}
              </div>
            </div>
          );
        })}
        <p className="muted mono" style={{ fontSize: 11, marginBottom: 0 }}>M Must, S Should, C Could. Outlined in color only when a stored test result exists for that ID.</p>
      </div>

      <div className="card" id="tests">
        <div className="cardhead"><h3>2 · Test results</h3><span className="tag">{failing.length ? `${failing.length} failing` : "no open failures"}</span></div>
        {!testIds.length && <p className="muted mono" style={{ fontSize: 12, margin: 0 }}>Not run.</p>}
        {testIds.map((id) => {
          const v = res.get(id)!;
          return (
            <div key={id} id={`t-${id}`} className="resrow" style={{ display: "block" }}>
              <span className="mono" style={{ color: col[v.status], fontWeight: 600 }}>{v.status === "pass" ? "Pass" : "Fail"}</span> <strong>{id}</strong>{" "}
              <span className="muted mono" style={{ fontSize: 11 }}>{v.n} saved result{v.n === 1 ? "" : "s"} · latest {v.date}</span>
              {v.fails.map((f) => (
                <div key={f.run_id + f.metric} className="muted mono" style={{ fontSize: 11 }}>
                  Failed {day(f.created_at)}: {f.metric}{f.value != null && f.threshold != null ? ` (${f.value} vs ${f.threshold})` : ""}
                </div>
              ))}
            </div>
          );
        })}
        {reqs.filter((r) => !res.has(r.id) && (r.priority === "M")).length > 0 && (
          <p className="muted mono" style={{ fontSize: 11, marginBottom: 0 }}>Must requirements with no stored result show as <span>Not run</span> (grey): {reqs.filter((r) => !res.has(r.id) && r.priority === "M").map((r) => r.id).join(", ")}.</p>
        )}
      </div>

      {superseded.length > 0 && (
        <div className="card" id="superseded">
          <div className="cardhead"><h3>Failures set aside as superseded</h3><span className="tag">{superseded.length}</span></div>
          {superseded.map((x) => (
            <div key={x.test_id + x.run_id} className="resrow" style={{ display: "block" }}>
              <strong>{x.test_id}</strong> <span className="muted mono" style={{ fontSize: 11 }}>run {x.run_id} · {x.decided}</span>
              <div className="muted mono" style={{ fontSize: 11 }}>{x.reason}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card" id="agents">
        <div className="cardhead"><h3>3 · The agents</h3>{isAdmin && <span className="tag">cost ${costTotal.toFixed(2)}</span>}</div>
        {!agents.length && <p className="muted mono" style={{ fontSize: 12, margin: 0 }}>No agent runs saved.</p>}
        {agents.map((x) => (
          <div key={x.agent_name + x.mode} className="resrow" style={{ display: "block" }}>
            <strong>{x.agent_name}</strong> <span className="tag">{x.mode}</span>
            <div className="muted mono" style={{ fontSize: 11 }}>{x.runs} run{x.runs === 1 ? "" : "s"} · last {day(x.last_run)}{x.last_model ? ` · ${x.last_model}` : ""}{isAdmin && x.cost_usd != null ? ` · $${Number(x.cost_usd).toFixed(2)}` : ""}</div>
          </div>
        ))}
      </div>

      <div className="card" id="timeline">
        <div className="cardhead"><h3>4 · Build timeline</h3></div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {milestones.map((m) => (
            <span key={m.id} className="tag" title={m.name} style={{ borderColor: m.status === "passed" ? col.pass : m.status === "in_progress" ? "var(--accent)" : undefined, opacity: m.status === "not_started" ? 0.6 : 1 }}>
              {m.id} · {m.name} · {m.status === "passed" ? "gate passed" : m.status === "in_progress" ? "in progress" : "not started"}
            </span>
          ))}
        </div>
      </div>

      <div className="card" id="sources">
        <div className="cardhead"><h3>5 · Where the data comes from</h3></div>
        <p className="muted" style={{ marginTop: 0 }}>Links come from SEC filings; prices and key numbers from Finnhub and Twelve Data. Real against sample links, per mapped company:</p>
        {share.map((c) => {
          const tot = c.real_links + c.sample_links;
          const pct = tot ? Math.round((c.real_links / tot) * 100) : 0;
          return (
            <div key={c.ticker} className="resrow">
              <span><strong>{c.name}</strong> <span className="muted mono" style={{ fontSize: 11 }}>{c.ticker}</span></span>
              <span className="mono" style={{ fontSize: 12 }}>{tot ? `${pct}% real · ${c.real_links} real, ${c.sample_links} sample` : "No links yet"}</span>
            </div>
          );
        })}
      </div>
    </main>
  );
}
