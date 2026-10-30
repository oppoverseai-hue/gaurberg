// Plain wording for the Exposure page (GRF-17). Presentation only: the rules stay in exposure-core.ts. Pure functions: no data access here.
import type { Rel } from "./graph";
import type { Exposure } from "./exposure-core";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2025-12-31" reads "Dec 2025". Anything else is not a date we can state, so it gives null. */
export function monthYear(d: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})/.exec(d ?? "");
  const month = m ? MONTHS[Number(m[2]) - 1] : undefined;
  return month ? `${month} ${m![1]}` : null;
}

/** What the other company is to `focalId`, in plain words, from the link's own direction. */
export function relationText(r: Rel, focalId: number, focalName: string): string {
  const otherIsSource = r.source.id !== focalId;
  switch (r.relationship_type) {
    case "supplies": return otherIsSource ? `Supplies ${focalName}` : `Buys from ${focalName}`;
    case "sells_to": return otherIsSource ? `Sells to ${focalName}` : `Buys from ${focalName}`;
    case "invests": return otherIsSource ? `Holds a stake in ${focalName}` : `${focalName} holds a stake`;
    case "acquires": return otherIsSource ? `Acquired ${focalName}` : `Acquired by ${focalName}`;
    case "partners": return `Partner of ${focalName}`;
    case "competes": return `Competes with ${focalName}`;
  }
}

const count = (n: number, one: string, many: string) => (n === 0 ? null : `${n} ${n === 1 ? one : many}`);

/** "54 linked companies: 3 state a share, 23 give no size, 19 competitors". Only counts that exist. Null when there is nothing to count. */
export function summaryLine(e: Exposure): string | null {
  const ranked = Object.values(e.ranked).flat();
  const rows = [...ranked, ...e.unweighted, ...e.partners, ...e.competitors];
  if (rows.length === 0) return null;
  const companies = new Set(rows.map((x) => x.co.id)).size;
  // One company can hold several links; the counts below follow the group headers, which count links.
  const total = `${companies} linked ${companies === 1 ? "company" : "companies"}${companies === rows.length ? "" : `, ${rows.length} links`}`;
  const parts = [
    count(ranked.length, "states a share", "state a share"),
    count(e.unweighted.length, "gives no size", "give no size"),
    count(e.partners.length, "partner", "partners"),
    count(e.competitors.length, "competitor", "competitors"),
  ].filter(Boolean);
  return `${total}: ${parts.join(", ")}`;
}
