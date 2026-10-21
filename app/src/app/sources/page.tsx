import Link from "next/link";
export default function Sources() {
  return (
    <main className="narrow">
      <Link href="/">← Home</Link>
      <h1>Sources</h1>
      <p className="muted">Where each kind of data comes from.</p>
      <div className="card"><ul>
        <li><b>Company links:</b> sentences quoted from SEC 10-K filings (sec.gov/EDGAR). Each link shows its quote, section, filing date and a link to the original.</li>
        <li><b>Prices:</b> Finnhub, delayed or end-of-day on the free plan.</li>
        <li><b>Trust badges:</b> Verified (found by an agent, quote matches word for word, passed checks, reviewed by the admin), Curated (entered by hand with a source note), Live-generated (created on request, not reviewed), Sample data (placeholder). Links not yet reviewed are tagged “Staged, not reviewed”.</li>
        <li><b>Not built yet:</b> news, About text and holders are not shown yet and say so.</li>
      </ul></div>
    </main>
  );
}
