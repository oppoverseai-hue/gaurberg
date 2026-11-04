// Public marketing pages (ACC-7, UX-10): home, /features, /how-it-works and /faq share this shell and these sections.
// Stitch "Warm Paper Analytical" design system. Illustrations are abstract (no product data, names or figures).
// Calls to action start Google sign-in directly, so the address bar never collects #anchors.
import "./landing.css";
import Link from "next/link";
import LoginButton from "@/components/LoginButton";
import Logo from "@/components/Logo";
import { Around, Constellation, Exposure, Receipt } from "./Illustrations";

export type Visitor = "signed_out" | "not_invited" | "ok";
export type Page = "home" | "features" | "how" | "faq";
export const em = (t: string) => <span className="pp-em">{t}</span>;

/** The one call to action, right for who is looking: sign in, finish the request, or open the app. */
export function Cta({ v, size = "md", label = "Request an invitation" }: { v: Visitor; size?: "sm" | "md"; label?: string }) {
  const cls = `pp-btn${size === "sm" ? " pp-btn-sm" : ""}`;
  if (v === "not_invited") return <Link className={cls} href="/request-access">Your request</Link>;
  if (v === "ok") return <Link className={cls} href="/">Open Gaurberg</Link>;
  return <LoginButton label={label} className={cls} />;
}

export function Shell({ v, page, children }: { v: Visitor; page: Page; children: React.ReactNode }) {
  const nav: [Page, string, string][] = [["features", "Features", "/features"], ["how", "How it works", "/how-it-works"], ["faq", "FAQ", "/faq"]];
  return (
    <div className="paper">
      <header className="pp-nav">
        <Link className="pp-brand" href="/" aria-label="Gaurberg home"><Logo /></Link>
        <nav className="pp-links" aria-label="Pages">
          {nav.map(([k, label, href]) => <Link key={k} href={href} aria-current={page === k ? "page" : undefined} className={page === k ? "on" : ""}>{label}</Link>)}
        </nav>
        <div className="pp-navcta">
          {v === "signed_out" && <LoginButton label="Sign in" className="pp-signin" />}
          <Cta v={v} size="sm" />
        </div>
      </header>
      <div className="pp-main">{children}</div>
      <footer className="pp-footer">
        <Link className="pp-brand" href="/" aria-label="Gaurberg home"><Logo /></Link>
        <p className="pp-em pp-tag">Know what moves a stock before it moves.</p>
        <nav><Link href="/features">Features</Link><Link href="/how-it-works">How it works</Link><Link href="/faq">FAQ</Link><Link href="/privacy">Privacy</Link><a href="mailto:oppoverseai@gmail.com">Contact</a></nav>
        <p className="pp-fine">Gaurberg provides research information only. It is not investment advice, does not recommend securities and does not place trades. Market data is delayed. Signing in with Google shares only your name, email and profile picture, which we use to manage your access.</p>
        <p className="pp-fine pp-mono">© 2026 Gaurberg</p>
      </footer>
    </div>
  );
}

/** Title block for the inner pages. */
export function PageHead({ over, title, sub }: { over: string; title: React.ReactNode; sub: string }) {
  return (
    <section className="pp-pagehead">
      <p className="pp-over pp-mono pp-center">{over}</p>
      <h1>{title}</h1>
      <p className="pp-lede">{sub}</p>
    </section>
  );
}

export function Hero({ v }: { v: Visitor }) {
  return (
    <section className="pp-hero2">
      <p className="pp-over pp-mono pp-center"><span className="pp-dot" />By invitation · Early access</p>
      <h1>Every stock has an {em("ecosystem.")}</h1>
      <p className="pp-lede">Gaurberg shows the suppliers, customers, partners, rivals and investors around a company, and the sentence from the filing behind every link.</p>
      <div className="pp-ctas"><Cta v={v} /><Link className="pp-ghost" href="/features">See what it does ›</Link></div>
      <p className="pp-note pp-mono">Free during early access · Not investment advice</p>
    </section>
  );
}

export function Problem() {
  return (
    <section className="pp-block">
      <p className="pp-over pp-mono pp-center">The problem</p>
      <h2 className="pp-center">A stock rarely moves {em("alone.")}</h2>
      <p className="pp-center pp-sub">A supplier misses, a big customer cuts back, a rival raises money, and the price moves. The trouble is finding those businesses before it happens.</p>
      <div className="pp-grid3">
        <article className="pp-card"><p className="pp-mono pp-num">01</p><h3>Buried in {em("filings.")}</h3><p>Who a company depends on is in its annual report, scattered across hundreds of pages and dozens of companies.</p></article>
        <article className="pp-card"><p className="pp-mono pp-num">02</p><h3>Locked in {em("terminals.")}</h3><p>The tools that map these links are built for big institutions and priced at five figures a year.</p></article>
        <article className="pp-card"><p className="pp-mono pp-num">03</p><h3>Answers without {em("sources.")}</h3><p>Chatbots answer in seconds, but you can&apos;t tell which line of which filing an answer came from, or whether it exists.</p></article>
      </div>
    </section>
  );
}

export function Solution() {
  return (
    <section className="pp-block pp-solution">
      <div>
        <p className="pp-over pp-mono">The solution</p>
        <h2>Meet {em("Gaurberg.")}</h2>
        <p className="pp-sub">Gaurberg reads what companies file about each other and turns it into a map you can check. Start from any company, follow the links, and read the source at every step.</p>
        <p style={{ marginTop: 24 }}><Link className="pp-ghost" href="/features">See every feature ›</Link></p>
      </div>
      <ul className="pp-vps">
        <li><b>See the whole picture</b><span>Suppliers, customers, partners, rivals, investors and acquisitions in one place.</span></li>
        <li><b>Trust what you read</b><span>Every link carries the sentence it came from. Nothing is estimated.</span></li>
        <li><b>Act sooner</b><span>Know which companies around yours report this week, and which just moved.</span></li>
      </ul>
    </section>
  );
}

const FEATURES = [
  { n: "01", key: "Map", title: <>See every business {em("around")} a stock.</>, body: "One map per company: who supplies it, who buys from it, who it partners with, competes with, invests in and has acquired.", points: ["Six kinds of link, each drawn in its own direction", "Click any company to move the map to it", "Filter by kind of link or by region"], art: <Constellation /> },
  { n: "02", key: "Proof", title: <>Every link has a {em("receipt.")}</>, body: "Open a line and read the sentence the company itself filed, with the filing date and a link straight to the source.", points: ["10-K, 20-F and annual reports", "Each quote checked word for word against the filing", "Unreviewed links are labelled, never mixed in"], art: <Receipt /> },
  { n: "03", key: "Exposure", title: <>Know who feels it {em("first.")}</>, body: "When one company stumbles, see which of its partners, suppliers and customers depend on it, ranked by the share the filings state.", points: ["Stated shares only; no estimates", "\"Size not disclosed\" when the filing doesn't say", "Rivals kept apart: their trouble cuts both ways"], art: <Exposure /> },
  { n: "04", key: "Around", title: <>Catch what moves {em("next door.")}</>, body: "Each company page shows which of its linked companies report this week and which moved sharply at the last close.", points: ["Earnings dates of the whole ecosystem", "Large moves among linked companies", "Connection finder: how any two companies are linked"], art: <Around /> },
];

export function FeatureRows() {
  return (
    <section className="pp-block pp-block-tight">
      {FEATURES.map((f, i) => (
        <div key={f.n} className={`pp-feature ${i % 2 ? "pp-flip" : ""}`}>
          <div className="pp-ftext">
            <p className="pp-mono pp-num">{f.n} · {f.key}</p>
            <h3>{f.title}</h3>
            <p>{f.body}</p>
            <ul>{f.points.map((p) => <li key={p}>{p}</li>)}</ul>
          </div>
          <div className="pp-plate">{f.art}</div>
        </div>
      ))}
    </section>
  );
}

/** Home-page teaser: the four features as compact cards, each linking to /features. */
export function FeatureTeaser() {
  return (
    <section className="pp-block">
      <p className="pp-over pp-mono pp-center">Features</p>
      <h2 className="pp-center">What you can {em("do.")}</h2>
      <div className="pp-grid4">
        {FEATURES.map((f) => <Link key={f.n} href="/features" className="pp-card pp-cardlink"><p className="pp-mono pp-num">{f.n} · {f.key}</p><h3>{f.title}</h3><p>{f.body}</p><span className="pp-more pp-mono">Read more ›</span></Link>)}
      </div>
    </section>
  );
}

export function Checked() {
  return (
    <section className="pp-block pp-people">
      <h2 className="pp-center">Agents do the reading. A {em("person")} does the checking.</h2>
      <div className="pp-duo" aria-hidden>
        <div className="pp-agent"><svg viewBox="0 0 32 32" width="64" height="64" aria-hidden><path d="M16 4 L28 16 L16 28 L4 16 Z" fill="#f1f5f9" /></svg><i /></div>
        <div className="pp-person">
          <svg viewBox="0 0 64 64" className="pp-person-ico"><circle cx="32" cy="24" r="11" fill="none" stroke="#2A211C" strokeWidth="2.5" /><path d="M12 54c2-11 10-17 20-17s18 6 20 17" fill="none" stroke="#2A211C" strokeWidth="2.5" strokeLinecap="round" /></svg>
          <svg viewBox="0 0 100 100" className="pp-stamp"><defs><path id="stampc" d="M50,50 m-38,0 a38,38 0 1,1 76,0 a38,38 0 1,1 -76,0" /></defs>
            <circle cx="50" cy="50" r="48" fill="#FBFAF7" stroke="#1C1916" /><circle cx="50" cy="50" r="28" fill="none" stroke="#1C1916" />
            <text className="pp-stamp-t"><textPath href="#stampc">REVIEWED BY HAND · REVIEWED BY HAND ·</textPath></text>
            <path d="M50 40 L60 50 L50 60 L40 50 Z" fill="#1C1916" /></svg>
        </div>
      </div>
      <p className="pp-center pp-who"><b>Gaurberg agents</b> read every filing. <b>A Gaurberg analyst</b> reviews every link.</p>
      <ol className="pp-pipe pp-mono">
        {["Agent reads the filing", "Finds each named company", "Checks the quote word for word", "A person keeps, fixes or drops it", "Published with its source"].map((t, i) => (
          <li key={t}>{i > 0 && <span className="pp-arrow" aria-hidden>→</span>}<span className="pp-step">{t}</span></li>
        ))}
      </ol>
      <p className="pp-center pp-sub">Prices, ratios and report dates refresh every day. A link reaches the map only after a person has read the sentence behind it.</p>
    </section>
  );
}

export function Why() {
  return (
    <section className="pp-block">
      <p className="pp-over pp-mono pp-center">Why Gaurberg</p>
      <h2 className="pp-center">Proof, not {em("prose.")}</h2>
      <div className="pp-grid3">
        <article className="pp-card"><p className="pp-mono pp-label">Sourced</p><h3>Read it in the {em("filing.")}</h3><p>Other tools give you a summary. Gaurberg gives you the sentence, the date and the link, so you can check it yourself in seconds.</p></article>
        <article className="pp-card"><p className="pp-mono pp-label">Connected</p><h3>Follow the {em("chain.")}</h3><p>Go from a company to its supplier to that supplier&apos;s customers, or pick any two companies and see how the filings connect them.</p></article>
        <article className="pp-card"><p className="pp-mono pp-label">Honest</p><h3>Gaps stay {em("gaps.")}</h3><p>No filled-in numbers. When a filing doesn&apos;t say how big a relationship is, Gaurberg tells you that instead of guessing.</p></article>
      </div>
    </section>
  );
}

export function Steps() {
  return (
    <section className="pp-block pp-block-tight">
      <ol className="pp-steps">
        <li><span className="pp-mono pp-num">Step 1</span><b>Request an invitation</b><span>Continue with Google and answer three quick questions.</span></li>
        <li><span className="pp-mono pp-num">Step 2</span><b>Search a company</b><span>Type a name or ticker. Suggestions appear as you type.</span></li>
        <li><span className="pp-mono pp-num">Step 3</span><b>Open its map</b><span>See who is around it, filter by kind of link, and follow any company.</span></li>
        <li><span className="pp-mono pp-num">Step 4</span><b>Read the source</b><span>Click a line to read the filing sentence behind it, then open the filing.</span></li>
      </ol>
    </section>
  );
}

export const FAQ: [string, string][] = [
  ["Who is Gaurberg for?", "Independent analysts, small funds and serious individual investors who want to understand the businesses behind a stock without paying for a full terminal."],
  ["Where does the information come from?", "From what companies file: US 10-K and 20-F reports and annual reports for London and Hong Kong listings. Every link shows the sentence it came from and where to read it. Prices and ratios are delayed market data."],
  ["Is this investment advice?", "No. Gaurberg shows what companies disclose about each other. It does not recommend, rate or predict anything, and it does not place trades."],
  ["How do invitations work?", "Continue with Google and answer three short questions. Invitations go out in small batches, and you get an email when yours is ready."],
  ["What will it cost?", "Nothing during early access. Pricing comes later, and early members hear first."],
  ["Can I ask for a company?", "Yes, in the request form or by replying to any of our emails. The most requested companies are mapped first."],
];

export function Faq({ items = FAQ }: { items?: [string, string][] }) {
  return <section className="pp-faq pp-faq-page">{items.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</section>;
}

export function Invite({ v, email }: { v: Visitor; email?: string }) {
  return (
    <section className="pp-invite">
      <div className="pp-envelope" aria-hidden />
      <div className="pp-invcard">
        <p className="pp-mono pp-label pp-center">By invitation</p>
        {v === "not_invited" ? (
          <>
            <h2 className="pp-center">Your request is {em("one step away.")}</h2>
            <p className="pp-center pp-muted">You&apos;re signed in{email ? ` as ${email}` : ""}.</p>
            <div className="pp-center" style={{ marginTop: 24 }}><Link className="pp-btn" href="/request-access">Continue to your request</Link></div>
          </>
        ) : v === "ok" ? (
          <>
            <h2 className="pp-center">You&apos;re {em("in.")}</h2>
            <p className="pp-center pp-muted">Your account is invited.</p>
            <div className="pp-center" style={{ marginTop: 24 }}><Link className="pp-btn" href="/">Open Gaurberg</Link></div>
          </>
        ) : (
          <>
            <h2 className="pp-center">Join the {em("first 500.")}</h2>
            <p className="pp-center pp-muted">Invitations go out in small batches while every new link is still reviewed by hand.</p>
            <ul className="pp-perks"><li>Free during early access</li><li>Tell us which company to map next, and we&apos;ll map it</li></ul>
            <div className="pp-center"><LoginButton label="Continue with Google" className="pp-btn pp-google" google /></div>
            <p className="pp-center pp-mono pp-tiny">Already invited? Continue with the same Google account.</p>
          </>
        )}
      </div>
    </section>
  );
}
