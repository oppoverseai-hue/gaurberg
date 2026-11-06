import { notFound, redirect } from "next/navigation";
import Breadcrumbs from "@/components/Breadcrumbs";
import Link from "next/link";
import { getAccess } from "@/lib/supabase/server";
import { renderTimer } from "@/lib/render-timing";
import { getCompany } from "@/lib/data";
import { cachedMarket } from "@/lib/page-cache";
import { readFinancials } from "@/lib/financials";
import { isUSListed } from "@/lib/marketdb";
import CompanyTabs from "@/components/CompanyTabs";
import FinancialsTable from "@/components/FinancialsTable";
import SourceTip from "@/components/SourceTip";

export const dynamic = "force-dynamic";

export default async function Financials({ params }: { params: Promise<{ ticker: string }> }) {
  const t = renderTimer("financials");
  const ticker = (await params).ticker.toUpperCase();
  // NFR-1: the sign-in check, the allowlist and the company lookup at once (the company read is under RLS; the role is still checked
  // before anything renders).
  const [access, company] = t.step("access+company", await Promise.all([getAccess(), getCompany(ticker)]));
  if (access.state !== "ok") redirect("/");
  if (!company) notFound();
  // Market data behind the same 5-minute cache as Overview (lib/page-cache.ts, shared key), not 5 live outside calls per visit. This
  // page uses only market cap and shares outstanding from it (Finnhub /stock/metric and /stock/profile2); the statements are saved files.
  const [m, fin] = [t.step("market", await cachedMarket(company)), readFinancials(ticker)];
  t.done(ticker);
  return (
    <main>
      <Breadcrumbs items={[{ label: company.name, href: `/company/${company.ticker ?? ticker}` }, { label: "Financials" }]} />
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
