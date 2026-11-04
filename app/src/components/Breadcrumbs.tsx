import Link from "next/link";

// Where you are, and one step back (UX-10). The last item is the current page; the back link goes to the item before it.
export type Crumb = { label: string; href?: string };

export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  const trail: Crumb[] = [{ label: "Home", href: "/" }, ...items];
  const back = [...trail].slice(0, -1).reverse().find((c) => c.href);
  return (
    <nav className="crumbs mono" aria-label="Breadcrumb">
      {back && <Link href={back.href!} className="crumbs-back">← {back.label}</Link>}
      <ol>
        {trail.map((c, i) => (
          <li key={`${c.label}${i}`}>
            {i < trail.length - 1 && c.href ? <Link href={c.href}>{c.label}</Link> : <span aria-current={i === trail.length - 1 ? "page" : undefined}>{c.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
