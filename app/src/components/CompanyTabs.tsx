import Link from "next/link";

// Tab bar shared by the company pages: Overview, Financials and the ecosystem map.
export default function CompanyTabs({ ticker, active }: { ticker: string; active: "overview" | "financials" }) {
  const tabs = [
    { k: "overview", label: "Overview", href: `/company/${ticker}` },
    { k: "financials", label: "Financials", href: `/company/${ticker}/financials` },
    { k: "map", label: "Ecosystem map →", href: `/map/${ticker}` },
  ];
  return (
    <nav className="ctabs" aria-label="Company sections">
      {tabs.map((t) => <Link key={t.k} href={t.href} className={t.k === active ? "on" : ""} aria-current={t.k === active ? "page" : undefined}>{t.label}</Link>)}
    </nav>
  );
}
