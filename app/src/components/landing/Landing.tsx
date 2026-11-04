// Public landing page (ACC-7), from the Stitch "Warm Paper Analytical" design (Nov 4, 2026).
// Shown on "/" to signed-out visitors and to signed-in people who are not invited yet (with the request form in place of
// the Google button). No video and no images: the map is inline SVG, the marquee is CSS, so the page loads fast.
// Every number is read from the database (landing-data.ts); every quote is word for word from a promoted evidence row.
import "./landing.css";
import LoginButton from "@/components/LoginButton";
import RequestAccess from "@/components/RequestAccess";
import EcoMap from "./EcoMap";
import Scenes, { type Scene } from "./Scenes";
import { getStats, QUOTES } from "./landing-data";

const COMPANIES = ["Uber", "NVIDIA", "TSMC", "AMD", "Microsoft", "Amazon", "Alphabet", "Vodafone", "Baidu", "CoreWeave", "Lyft", "DoorDash", "Aurora", "Grab", "WeRide", "Lenovo"];
const TERMS = ["Supplies", "Sells to", "Partners", "Competes", "Invests in", "Acquired", "10-K", "20-F", "Annual report", "Quote found word for word"];
const em = (t: string) => <span className="pp-em">{t}</span>;
const fmt = (n: number) => n.toLocaleString("en-US");

const FAQ: [string, string][] = [
  ["Where does the data come from?", "Public filings: US 10-K and 20-F reports from SEC EDGAR, and annual reports for London and Hong Kong listings. Every link shows the sentence it came from, the filing date and a link to the source. Prices and ratios come from market-data services and are delayed."],
  ["Is this investment advice?", "No. Gaurberg shows what companies disclose about each other. It does not recommend, rate or predict anything, and it does not place trades."],
  ["Which markets are covered?", "Fully mapped companies are listed in the US, London and Hong Kong. Live prices, news and insider trades cover US listings for now."],
  ["How do invitations work?", "Continue with Google and answer three short questions. Invitations go out in small batches, and you get an email when yours is ready."],
  ["What will it cost?", "It is free during early access. Pricing comes later, and early members hear first."],
  ["Can I suggest a company?", "Yes. Tell us in the request form or reply to any of our emails; the most requested companies get mapped first."],
];

export default async function Landing({ state, email }: { state: "signed_out" | "not_invited"; email?: string }) {
  const s = await getStats();
  const by = s?.uberByType ?? {};
  const scenes: Scene[] = [
    { key: "ECOSYSTEM", tab: "Who moves Uber?", title: <>Who moves {em("Uber?")}</>, body: "Suppliers, customers, partners and rivals on one map. Each line is a relationship a filing discloses.",
      facts: s ? [[String(by.competes ?? 0), "competitors"], [String(by.partners ?? 0), "partners"], [String((by.invests ?? 0) + (by.acquires ?? 0)), "stakes and acquisitions"]] : [] },
    { key: "RECEIPTS", tab: "Every link has a receipt", title: <>Every link has a {em("receipt.")}</>, body: "Click a line to read the sentence from the filing, with its date and a link to the source.", facts: [], quote: QUOTES.lyft, focus: ["Lyft"] },
    { key: "EXPOSURE", tab: "See who is exposed", title: <>See who is {em("exposed.")}</>, body: "If a company is hit, see which linked companies the filings tie to it, with the stated share where the filing gives one.",
      facts: [["5.6%", "Uber's stake in WeRide"], ["86%", "Uber's holding in Trendyol GO"]], focus: ["WeRide", "Aurora", "Lucid"] },
    { key: "PATHWAYS", tab: "Find the path", title: <>Find the {em("path.")}</>, body: "Pick any two companies and see how the filings connect them, directly or through one shared company.", facts: [["NVIDIA → Baidu → Uber", ""]], quote: QUOTES.apollo, focus: ["Baidu"], path: true },
  ];

  return (
    <div className="paper">
      <header className="pp-nav">
        <a className="pp-brand" href="#top"><span className="pp-mark" aria-hidden>◆</span>Gaurberg</a>
        <nav className="pp-links"><a href="#product">Product</a><a href="#how">How it works</a><a href="#faq">FAQ</a></nav>
        <div className="pp-navcta">
          {state === "signed_out" && <LoginButton label="Sign in" className="pp-signin" />}
          <a className="pp-btn pp-btn-sm" href="#access">Request an invitation</a>
        </div>
      </header>

      <div className="pp-main" id="top">
        <section className="pp-hero">
          <p className="pp-over pp-mono"><span className="pp-dot" />By invitation · Early access</p>
          <h1>Every stock has an {em("ecosystem.")}</h1>
          <p className="pp-lede">Gaurberg maps who supplies, buys from, partners with, competes with and invests in a company. Every link comes with the exact sentence from the filing.</p>
          <div className="pp-ctas"><a className="pp-btn" href="#access">Request an invitation</a><a className="pp-ghost" href="#product">See Uber&apos;s map ›</a></div>
        </section>

        <section className="pp-term pp-heroterm" id="product" aria-label="Uber's ecosystem map">
          <div className="pp-termbar"><span className="pp-mono">ECOSYSTEM MAP · UBER TECHNOLOGIES (NYSE: UBER)</span><span className="pp-mono pp-cyan">{s ? `${s.uberLinks} REVIEWED LINKS` : "REVIEWED LINKS"} · 10-K FILED 2026-02-13</span></div>
          <EcoMap />
          <div className="pp-termfoot pp-mono"><span className="pp-cyan">UBER 10-K · RISK FACTORS:</span> “{QUOTES.minority.text}”</div>
        </section>
      </div>

      <section className="pp-marquee" aria-label="Companies and link types">
        <div className="pp-row"><div className="pp-track">{[...COMPANIES, ...COMPANIES].map((c, i) => <span key={i} className="pp-pill">{c}</span>)}</div></div>
        <div className="pp-row pp-rev"><div className="pp-track">{[...TERMS, ...TERMS].map((t, i) => <span key={i} className="pp-mono pp-term-chip">{t}<i>◇</i></span>)}</div></div>
      </section>

      <div className="pp-main">
        <section className="pp-section" id="how">
          <p className="pp-over pp-mono">What it does</p>
          <h2>How filings turn into {em("intelligence.")}</h2>
          <Scenes scenes={scenes} />
        </section>

        <section className="pp-cards3">
          <article className="pp-card"><p className="pp-mono pp-label">Sourced</p><h3>Read it in the {em("filing.")}</h3><p>Each relationship shows the sentence from the 10-K, 20-F or annual report it came from, with the filing date and a link to the source.</p><p className="pp-mono pp-foot">Quote found word for word</p></article>
          <article className="pp-card"><p className="pp-mono pp-label">Reviewed</p><h3>Checked by a {em("person.")}</h3><p>AI reads the filings; every published link is reviewed by hand before it appears. Links that are not reviewed yet are labelled.</p><p className="pp-mono pp-foot">Reviewed by hand</p></article>
          <article className="pp-card"><p className="pp-mono pp-label">Honest</p><h3>Gaps stay {em("gaps.")}</h3><p>No estimates and no filled-in numbers. When a filing doesn&apos;t say how big a relationship is, Gaurberg says so.</p><p className="pp-mono pp-foot">No estimates</p></article>
        </section>

        {s && (
          <section className="pp-stats" aria-label="Coverage">
            <div><b>{fmt(s.links)}</b><span className="pp-mono">Reviewed links</span></div>
            <div><b>{fmt(s.companies)}</b><span className="pp-mono">Companies in the graph</span></div>
            <div><b>{fmt(s.mapped)}</b><span className="pp-mono">Fully mapped</span></div>
            <div><b className="pp-small">SEC · LSE · HKEX</b><span className="pp-mono">Filings read</span></div>
          </section>
        )}

        <section className="pp-invite" id="access">
          <div className="pp-envelope" aria-hidden />
          <div className="pp-invcard">
            {state === "not_invited" && email ? <RequestAccess email={email} /> : (
              <>
                <p className="pp-mono pp-label pp-center">By invitation</p>
                <h2 className="pp-center">Join the {em("first 500.")}</h2>
                <p className="pp-center pp-muted">Invitations go out in small batches while every new link is still reviewed by hand.</p>
                <ul className="pp-perks"><li>Free during early access</li><li>Tell us which company to map next, and we&apos;ll map it</li></ul>
                <div className="pp-center"><LoginButton label="Continue with Google" className="pp-btn pp-google" google /></div>
                <p className="pp-center pp-mono pp-tiny">Already invited? Continue with the same Google account.</p>
              </>
            )}
          </div>
        </section>

        <section className="pp-faq" id="faq">
          <p className="pp-over pp-mono pp-center">Questions</p>
          <h2 className="pp-center">Frequently {em("asked.")}</h2>
          {FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
        </section>
      </div>

      <footer className="pp-footer">
        <a className="pp-brand" href="#top"><span className="pp-mark" aria-hidden>◆</span>Gaurberg</a>
        <p className="pp-em pp-tag">Know what moves a stock before it moves.</p>
        <nav><a href="/privacy">Privacy</a><a href="mailto:oppoverseai@gmail.com">Contact</a><a href="/sources">Sources</a></nav>
        <p className="pp-fine">Gaurberg provides research information only. It is not investment advice, does not recommend securities and does not place trades. Market data is delayed. Signing in with Google shares only your name, email and profile picture, which we use to manage your access.</p>
        <p className="pp-fine pp-mono">© 2026 Gaurberg</p>
      </footer>
    </div>
  );
}
