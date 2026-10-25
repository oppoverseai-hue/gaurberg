import Link from "next/link";
// One home for where each kind of data comes from (DEM-2). Company pages carry no visible source sentences, only an (i)
// tooltip per block with its source and as-of date; this page is the full list. Keep it in step with what the app shows.
export default function Sources() {
  return (
    <main className="narrow">
      <Link href="/" className="mono" style={{ fontSize: 12 }}>← Home</Link>
      <h1 style={{ marginTop: 12 }}>Sources</h1>
      <p className="muted">Where each kind of data comes from. On a company page, hover the (i) beside a block for its source and as-of date.</p>
      <div className="card"><ul className="srclist">
        <li><b>Company links:</b> sentences quoted from SEC 10-K filings for US companies and 20-F filings for foreign issuers listed in the US (sec.gov/EDGAR), and from annual reports for London and Hong Kong companies where loaded. Each link shows its quote, the section or page, the filing date and a link to the original.</li>
        <li><b>Revenue by region:</b> from the company&apos;s own annual report, with the page cited; loaded so far for the London companies. Where a report gives no split by region, none is shown, and the company is not placed in any region.</li>
        <li><b>Financial statements (Financials tab):</b> saved SEC EDGAR filings (10-K and 10-Q) for US companies: four fiscal years plus the trailing twelve months, with derived lines labelled as derived. No estimates. Companies listed outside the US say &ldquo;Not loaded: source is the annual report&rdquo;.</li>
        <li><b>Key metrics, analyst ratings and earnings dates:</b> Finnhub free plan, stored with an as-of date. US listings only. Rows not yet reviewed are visible to the admin only, marked “Staged, not reviewed”. Margins and growth beyond ±1,000% show n/m, with the stored value in the tooltip.</li>
        <li><b>Prices and key numbers:</b> Finnhub, delayed or end of day. <b>Price history</b> for the chart: Twelve Data, end-of-day closes.</li>
        <li><b>News:</b> Finnhub company news and SEC EDGAR filings from the last 30 days, read live. <b>Insider trades:</b> SEC Form 4 filings, read live.</li>
        <li><b>Saved data:</b> if a live call fails, or the app runs in offline demo mode, the page shows data saved earlier and says so, with the date. Anything typed in by the admin is labelled “provided by admin”.</li>
        <li><b>Trust badges:</b> Verified (found by an agent, quote matches word for word, passed checks, reviewed by the admin), Curated (entered by hand with a source note), Live-generated (created on request, not reviewed), Sample data (placeholder). Links not yet reviewed are tagged “Staged, not reviewed”.</li>
        <li><b>Not built yet:</b> holders from 13F reports; prices and key numbers for companies listed only in London or Hong Kong (Finnhub&apos;s free plan covers US listings only); About text for the companies added in the London and Hong Kong rounds (including Baidu, Pony.ai and WeRide); revenue by region for US and Hong Kong companies.</li>
      </ul></div>
    </main>
  );
}
