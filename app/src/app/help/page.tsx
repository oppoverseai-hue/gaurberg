import Link from "next/link";
export default function Help() {
  const rows: [string, string][] = [
    ["Uber  or  UBER", "Open the company page. Type a company name or its ticker."],
    ["Uber chart", "Jump to the price chart (1M, 6M, 1Y, 5Y)."],
    ["Uber numbers", "Jump to the key numbers: previous close, ranges, volume, market cap, P/E, EPS."],
    ["Uber about", "Jump to the About section."],
    ["Uber highlights", "Jump to financial highlights (also: financials, fundamentals)."],
    ["Uber links", "Jump to the top linked companies."],
    ["Uber news", "Jump to Recent news (not built yet; the section says so)."],
    ["Uber map", "Open the ecosystem map (also: Uber ecosystem)."],
    ["help", "This page."],
  ];
  return (
    <main className="narrow">
      <Link href="/">← Home</Link>
      <h1 style={{ marginTop: 12 }}>Commands</h1>
      <p className="muted">Use the command bar at the top of every screen. A company name or ticker, plus an optional plain word.</p>
      <div className="card"><table className="helptable"><thead><tr><th>Type</th><th>What it does</th></tr></thead><tbody>
        {rows.map(([a, b]) => <tr key={a}><td>{a}</td><td>{b}</td></tr>)}
      </tbody></table></div>
      <p className="muted mono" style={{ fontSize: 11 }}>Only the mapped companies are searchable in this version. A name that matches several companies opens a list.</p>
    </main>
  );
}
