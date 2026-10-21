// M7 live lookup (J5: LIV-1..LIV-3, NFR-5, NFR-6). Researches the first ring of one SEC filer from its latest annual report.
// Free-tier Gemini only (cost cap $0). If the model is unavailable the lookup is queued for Claude Code (LIV-E9). Writes status 'live' rows only.
// Secrets (server-side only): GEMINI_API_KEY, LIVE_LOOKUP_MODEL (the live_lookup role in config/models.yaml). Never printed or returned.
import { createClient } from "npm:@supabase/supabase-js@2";

const UA = "Gaurberg Research abhishek.g16@fms.edu";
const CHUNK = 150_000, MAX_CHUNKS = 4;
const URLS = { url: Deno.env.get("SUPABASE_URL")!, anon: Deno.env.get("SUPABASE_ANON_KEY")!, svc: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! };
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: cors });
const admin = () => createClient(URLS.url, URLS.svc);
const norm = (s: string) => s.replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim().toLowerCase();

const RULES = `You extract company relationships from SEC filings for a market-data product. Output JSON only.
Find every relationship in the filing text between the focal company and another NAMED company or organisation.
Allowed types: supplies (source = supplier, target = customer), sells_to (source = seller, target = buyer), partners (focal as source), competes (focal as source), invests (source = investor, target = investee), acquires (source = acquirer, target = acquired).
Rules: use only what the text states; "quotes" must be copied character for character from the text (one or two sentences), otherwise leave the link out; skip generic groups and the focal company itself; one object per counterparty and type; counterparty is the common short name; entity_type is one of public_company, private_company, institution, organization; exposure_pct only when the text states a percentage for this link, else null.
Return a JSON array of objects with keys counterparty, entity_type, type, source, target, quotes (list of strings), exposure_pct. Return [] if none. Source and target are "FOCAL" or the counterparty name.`;

type Edge = { counterparty: string; entity_type?: string; type: string; source: string; target: string; quotes: string[]; exposure_pct?: number | null };

async function sec(url: string, text = true) {
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`SEC ${r.status}`);
  return text ? await r.text() : await r.json();
}

function htmlToText(h: string) {
  return h.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<\/(p|div|tr|li|h\d|br|table)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/&#8217;|&rsquo;/g, "’").replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"').replace(/&#\d+;|&[a-z]+;/g, " ")
    .replace(/[ \t\f\r]+/g, " ").replace(/\n\s*\n+/g, "\n");
}

async function resolveCompany(q: string) {
  const idx = await sec("https://www.sec.gov/files/company_tickers.json", false) as Record<string, { cik_str: number; ticker: string; title: string }>;
  const all = Object.values(idx), s = norm(q);
  const exact = all.find((c) => c.ticker.toLowerCase() === s) ?? all.find((c) => norm(c.title) === s);
  const hit = exact ?? all.find((c) => norm(c.title).startsWith(s)) ?? all.find((c) => norm(c.title).includes(s));
  return hit ? { cik: String(hit.cik_str).padStart(10, "0"), ticker: hit.ticker.toUpperCase(), name: hit.title } : null;
}

async function latestAnnual(cik: string) {
  const s = await sec(`https://data.sec.gov/submissions/CIK${cik}.json`, false) as { filings: { recent: Record<string, string[]> } };
  const r = s.filings.recent;
  for (let i = 0; i < r.form.length; i++) if (["10-K", "20-F", "40-F"].includes(r.form[i])) {
    return { url: `https://www.sec.gov/Archives/edgar/data/${parseInt(cik)}/${r.accessionNumber[i].replace(/-/g, "")}/${r.primaryDocument[i]}`, filed: r.filingDate[i], period: r.reportDate[i] };
  }
  return null;
}

class ModelUnavailable extends Error {}
async function gemini(prompt: string) {
  const key = Deno.env.get("GEMINI_API_KEY"), model = Deno.env.get("LIVE_LOOKUP_MODEL");
  if (!key || !model) throw new ModelUnavailable("model not configured");
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: RULES }] }, contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0 } }),
  });
  if (r.status === 429 || r.status === 403 || r.status === 503) throw new ModelUnavailable(`free allowance used up or model busy (${r.status})`);
  if (!r.ok) throw new Error(`model error ${r.status}`);
  const b = await r.json();
  const text = b.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "[]";
  const u = b.usageMetadata ?? {};
  let edges: Edge[] = [];
  try { const j = JSON.parse(text); edges = Array.isArray(j) ? j : []; } catch { edges = []; }
  return { edges, tin: u.promptTokenCount ?? 0, tout: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0), model };
}

async function step(db: ReturnType<typeof admin>, id: number, step: string, extra: Record<string, unknown> = {}) {
  await db.from("lookup_queue").update({ step, ...extra }).eq("id", id);
}

async function run(id: number, q: { ticker: string; name: string; cik: string }) {
  const db = admin();
  let runId: number | null = null, tin = 0, tout = 0, model = Deno.env.get("LIVE_LOOKUP_MODEL") ?? "unconfigured";
  try {
    await step(db, id, "Finding the latest filing");
    const f = await latestAnnual(q.cik);
    if (!f) { await step(db, id, "No annual report found", { status: "done", links_found: 0, finished_at: new Date().toISOString() }); return; }
    await step(db, id, "Reading the filing");
    const text = htmlToText(await sec(f.url));
    const parts: string[] = []; let cur = "";
    for (const p of text.split("\n")) { if (cur.length + p.length > CHUNK && cur) { parts.push(cur); cur = ""; } cur += p + "\n"; }
    if (cur.trim()) parts.push(cur);
    const use = parts.slice(0, MAX_CHUNKS), hay = norm(text);
    await step(db, id, "Finding links");
    const res = await Promise.all(use.map((c) => gemini(`Focal company: ${q.name} (${q.ticker}). Use FOCAL for the focal company in source/target.\n\nFILING TEXT:\n${c}`)));
    res.forEach((r) => { tin += r.tin; tout += r.tout; model = r.model; });
    await step(db, id, "Checking quotes");
    const seen = new Set<string>(), edges: Edge[] = [];
    for (const e of res.flatMap((r) => r.edges)) {
      if (!e?.counterparty || !e.type || !Array.isArray(e.quotes)) continue;
      if (!["supplies", "sells_to", "partners", "competes", "invests", "acquires"].includes(e.type)) continue;
      const focalSide = e.source === "FOCAL" || e.target === "FOCAL";
      if (!focalSide || norm(e.counterparty) === norm(q.name)) continue;
      const quotes = e.quotes.filter((x) => typeof x === "string" && x.length > 20 && hay.includes(norm(x))).slice(0, 3);
      if (!quotes.length) continue; // LIV-E6: a link without a found quote is dropped
      const k = `${e.source}|${e.type}|${e.target}|${e.counterparty}`;
      if (seen.has(k)) continue; seen.add(k); edges.push({ ...e, quotes });
    }
    await step(db, id, "Saving");
    let focal = (await db.from("companies").select("id").eq("ticker", q.ticker).maybeSingle()).data;
    if (!focal) focal = (await db.from("companies").insert({ ticker: q.ticker, name: q.name, cik: q.cik, entity_type: "public_company", is_seed: false }).select("id").single()).data;
    const ar = await db.from("agent_runs").insert({ agent_name: "live_lookup", mode: "live", target: q.ticker, model, tokens_in: tin, tokens_out: tout, cost_usd: 0, status: "completed", review_status: "unreviewed", finished_at: new Date().toISOString() }).select("id").single();
    runId = ar.data?.id ?? null;
    let saved = 0;
    for (const e of edges) {
      let other = (await db.from("companies").select("id").ilike("name", e.counterparty.replace(/[%_]/g, "")).limit(1)).data?.[0];
      if (!other) {
        const seed = (await db.from("companies").select("id").ilike("name", `${e.counterparty.replace(/[%_]/g, "")} %`).eq("is_seed", true).limit(2)).data;
        if (seed?.length === 1) other = seed[0];
      }
      if (!other) {
        const t = ["public_company", "private_company", "institution", "organization"].includes(e.entity_type ?? "") ? e.entity_type : "organization";
        other = (await db.from("companies").insert({ name: e.counterparty, entity_type: t, is_seed: false }).select("id").single()).data!;
      }
      let a = e.source === "FOCAL" ? focal!.id : other.id, b = e.target === "FOCAL" ? focal!.id : other.id;
      if (a === b) continue;
      if ((e.type === "partners" || e.type === "competes") && a > b) [a, b] = [b, a];
      const ex = (await db.from("relationships").select("id").eq("source_id", a).eq("target_id", b).eq("relationship_type", e.type).limit(1)).data?.[0];
      if (ex) continue;
      const rel = await db.from("relationships").insert({ source_id: a, target_id: b, relationship_type: e.type, exposure_pct: null, exposure_basis: "none", source_type: "sec_filing", status: "live", trust_status: "live_generated", run_id: runId, as_of_date: f.period }).select("id").single();
      if (!rel.data) continue;
      await db.from("evidence").insert(e.quotes.map((x) => ({ relationship_id: rel.data!.id, document_url: f.url, section: "filing", quote: x, quote_found: true, published_at: f.filed })));
      saved++;
    }
    await step(db, id, saved ? "Done" : "No disclosed relationships found", { status: "done", links_found: saved, company_id: focal!.id, run_id: runId, finished_at: new Date().toISOString() });
  } catch (err) {
    if (err instanceof ModelUnavailable) {
      await step(db, id, "Queued", { status: "queued", error: err.message }); // no free model: Claude Code processes the queue later
      return;
    }
    await db.from("agent_runs").insert({ agent_name: "live_lookup", mode: "live", target: q.ticker, model, tokens_in: tin, tokens_out: tout, cost_usd: 0, status: "failed", review_status: "unreviewed", finished_at: new Date().toISOString() });
    await step(db, id, "Failed", { status: "failed", error: String((err as Error).message).slice(0, 300), finished_at: new Date().toISOString() });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({});
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const user = createClient(URLS.url, URLS.anon, { global: { headers: { Authorization: auth } } });
    const { data: u } = await user.auth.getUser();
    const email = u.user?.email?.toLowerCase();
    if (!email) return json({ state: "error", message: "Sign in first." }, 401);
    const { data: al } = await user.from("allowlist").select("role").maybeSingle();
    if (!al) return json({ state: "error", message: "This account is not on the invite list." }, 403);
    const body = await req.json().catch(() => ({}));
    const db = admin();

    if (body.action === "status") {
      const { data } = await user.from("lookup_queue").select("id,status,step,ticker,links_found,error").eq("id", Number(body.id)).maybeSingle();
      return json(data ? { state: data.status, ...data } : { state: "error", message: "Lookup not found." }, data ? 200 : 404);
    }

    const query = String(body.query ?? "").trim().slice(0, 80);
    if (query.length < 2) return json({ state: "error", message: "Type a company name or ticker." }, 400);
    const co = await resolveCompany(query);
    if (!co) return json({ state: "not_found", message: "No SEC filer found for that name. Live lookup covers US-listed companies that file annual reports." });

    // Same company again: return what is saved, cost nothing, use no allowance (LIV: cached).
    const have = (await db.from("companies").select("id").eq("ticker", co.ticker).maybeSingle()).data;
    if (have) {
      const n = (await db.from("relationships").select("id", { count: "exact", head: true }).or(`source_id.eq.${have.id},target_id.eq.${have.id}`).in("status", ["promoted", "live"])).count ?? 0;
      if (n > 0) return json({ state: "cached", ticker: co.ticker, name: co.name });
    }

    // One lookup per person per day, except the admin (ACC-5, NFR-6).
    if (al.role !== "admin") {
      const day = new Date(); day.setUTCHours(0, 0, 0, 0);
      const used = (await db.from("lookup_log").select("id", { count: "exact", head: true }).ilike("email", email).gte("created_at", day.toISOString()).neq("outcome", "refused")).count ?? 0;
      if (used >= 1) {
        await db.from("lookup_log").insert({ email, query, cost_usd: 0, outcome: "refused" });
        return json({ state: "limit", message: "You have used today's live lookup. Try again tomorrow, or open one of the mapped companies." });
      }
    }

    const { data: q } = await db.from("lookup_queue").insert({ email, query, status: "running", step: "Finding the latest filing", ticker: co.ticker }).select("id").single();
    await db.from("lookup_log").insert({ email, query, cost_usd: 0, outcome: "accepted", queue_id: q!.id });
    // @ts-ignore EdgeRuntime is provided by the Supabase runtime
    EdgeRuntime.waitUntil(run(q!.id, co));
    return json({ state: "running", id: q!.id, ticker: co.ticker, name: co.name });
  } catch (err) {
    return json({ state: "error", message: String((err as Error).message).slice(0, 200) }, 500);
  }
});
