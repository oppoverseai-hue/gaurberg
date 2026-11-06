"use client";
// The frame a company tab shows the moment it is tapped (NFR-1, loading.tsx): the ticker chip and the tab bar with the tapped tab
// active, then placeholders while the page data loads. Nothing in it is data: the company name and numbers arrive with the page.
import { useParams, usePathname } from "next/navigation";
import CompanyTabs, { type CompanyTab } from "@/components/CompanyTabs";

const TAB_OF: Record<string, CompanyTab> = { financials: "financials", earnings: "earnings", map: "map", exposure: "exposure" };

export default function TabSkeleton() {
  const ticker = String(useParams<{ ticker: string }>().ticker ?? "").toUpperCase();
  const last = usePathname().split("/").filter(Boolean).at(-1) ?? "";
  const active = TAB_OF[last] ?? "overview";
  return (
    <main aria-busy="true" aria-label="Loading">
      <div className="sk-line sk-crumb" />
      <div className="head"><div className="row1"><span className="sk-line sk-title" /><span className="tag">{ticker}</span></div></div>
      <CompanyTabs ticker={ticker} active={active} />
      <div className="sk-grid"><div className="card sk-card" /><div className="card sk-card" /></div>
      <div className="card sk-card sk-wide" />
      <p className="muted mono sk-note" role="status">Loading…</p>
    </main>
  );
}
