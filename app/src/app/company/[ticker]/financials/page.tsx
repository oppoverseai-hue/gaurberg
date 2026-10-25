import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getAccess } from "@/lib/supabase/server";
import { getCompany } from "@/lib/data";
import { getMarket } from "@/lib/market";
import { readFinancials } from "@/lib/financials";
import { isUSListed } from "@/lib/marketdb";
import CompanyTabs from "@/components/CompanyTabs";
import FinancialsTable from "@/components/FinancialsTable";
import SourceTip from "@/components/SourceTip";

export const dynamic = "force-dynamic";

export default async function Financials({ params }: { params: Promise<{ ticker: string }> }) {
  const access = await getAccess();
  if (access.state !== "ok") redirect("/");
  const ticker = (await params).ticker.toUpperCase();
  const company = await getCompany(ticker);
  if (!company) notFound();
  const [m, fin] = [await getMarket(company), readFinancials(ticker)];
  return (
    <main>
      <Link href="/" className="mono" style={{ fontSize: 12 }}>← Search</Link>
      <div className="head"><div className="row1"><h1>{company.name}</h1><span className="tag">{company.ticker}</span></div></div>
      <CompanyTabs ticker={company.ticker ?? ticker} active="financials" />
      <div className="card" id="financials" style={{ marginTop: 0 }}>
        <div className="cardhead"><h3>Financial statements</h3>{fin?.status === "ok" ? <SourceTip text={`SEC EDGAR 10-K and 10-Q filings, saved ${fin.saved_at}`} /> : isUSListed(company.markets) ? <span className="label">Sample</span> : <SourceTip text="The company's annual report (not loaded)" />}</div>
        {fin?.status === "ok" ? (
          <>
            <FinancialsTable fin={fin} marketCap={m.f?.marketCap ?? null} shares={m.f?.shares ?? null} />
            <p className="muted mono" style={{ fontSize: 10, margin: "8px 0 0" }}>Last 4 fiscal years plus LTM (latest fiscal year plus year-to-date, minus the same period a year earlier). Lines the filer did not tag show n/a. EBITDA and free cash flow are derived. No analyst estimates are shown. This describes filings and is not a recommendation.</p>
          </>
        ) : (
          <p className="muted mono" style={{ fontSize: 12, margin: 0 }}>{isUSListed(company.markets) ? `Sample: ${fin?.note ?? "no saved statements for this company."}` : "Not loaded: source is the annual report."}</p>
        )}
      </div>
    </main>
  );
}
