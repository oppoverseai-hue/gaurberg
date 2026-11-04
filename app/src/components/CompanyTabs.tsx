import Link from "next/link";

// Tab bar shared by every company screen, all under /company/<TICKER>/ (UX-10): Overview, Financials, Ecosystem map, Who is exposed.
export type CompanyTab = "overview" | "financials" | "map" | "exposure";
export const TAB_LABEL: Record<CompanyTab, string> = { overview: "Overview", financials: "Financials", map: "Ecosystem map", exposure: "Who is exposed" };

export default function CompanyTabs({ ticker, active }: { ticker: string; active: CompanyTab }) {
  const tabs: { k: CompanyTab; href: string }[] = [
    { k: "overview", href: `/company/${ticker}` },
    { k: "financials", href: `/company/${ticker}/financials` },
    { k: "map", href: `/company/${ticker}/map` },
    { k: "exposure", href: `/company/${ticker}/exposure` },
  ];
  return (
    <nav className="ctabs" aria-label="Company sections">
      {tabs.map((t) => <Link key={t.k} href={t.href} className={t.k === active ? "on" : ""} aria-current={t.k === active ? "page" : undefined}>{TAB_LABEL[t.k]}</Link>)}
    </nav>
  );
}
