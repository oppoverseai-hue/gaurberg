import Link from "next/link";
export default function Sources() {
  return (
    <main className="narrow">
      <Link href="/" className="mono" style={{ fontSize: 12 }}>← Home</Link>
      <h1 style={{ marginTop: 12 }}>Sources</h1>
      <p className="muted">Where each kind of data comes from.</p>
      <div className="card"><ul className="srclist">
        <li><b>Company links:</b> sentences quoted from SEC 10-K filings (sec.gov/EDGAR). Each link shows its quote, section, filing date and a link to the original.</li>
        <li><b>Prices, key numbers and financial highlights:</b> Finnhub, delayed or end-of-day on the free plan. Price history for the chart: Twelve Data.</li>
        <li><b>Saved data:</b> if a live call fails, or the app runs in offline demo mode, the page shows data saved earlier and says so, with the date. Anything typed in by the admin is labelled “provided by admin”.</li>
        <li><b>Trust badges:</b> Verified (found by an agent, quote matches word for word, passed checks, reviewed by the admin), Curated (entered by hand with a source note), Live-generated (created on request, not reviewed), Sample data (placeholder). Links not yet reviewed are tagged “Staged, not reviewed”.</li>
        <li><b>Not built yet:</b> news, holders, and About text for companies without saved text. They say “not available yet”.</li>
      </ul></div>
    </main>
  );
}
