import Link from "next/link";
import { shortName } from "@/lib/about-core";

// Where you are (UX-10, UX-4). Desktop: one breadcrumb, every ancestor a link, the current page plain text.
// Phone (under 600 px): the breadcrumb is hidden and one back link goes to the parent page, so the bar stays one row.
export type Crumb = { label: string; href?: string };

export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  const trail: Crumb[] = [{ label: "Home", href: "/" }, ...items];
  const parent = trail.at(-2);
  return (
    <nav className="crumbs mono" aria-label="Breadcrumb">
      <ol>
        {trail.map((c, i) => (
          <li key={`${c.label}${i}`}>
            {i < trail.length - 1 && c.href ? <Link href={c.href}>{c.label}</Link> : <span aria-current={i === trail.length - 1 ? "page" : undefined}>{c.label}</span>}
          </li>
        ))}
      </ol>
      {parent?.href && <Link href={parent.href} className="crumbs-back">‹ {shortName(parent.label)}</Link>}
    </nav>
  );
}
