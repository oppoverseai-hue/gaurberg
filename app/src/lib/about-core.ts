// Company segment and the About rows (UX-4). Pure functions: no data access here.
// One segment taxonomy: companies.segment (consumer, business, infrastructure) is the only "Segment" anywhere: the page header,
// About, Peers, the Screener and the map preview. Finnhub's finnhubIndustry is a different scheme (Apple is "Technology" there,
// consumer here) and covers US listings only, so it gets its own About row, "Industry (Finnhub)", and is never used as a segment.

export const SEGMENT = "Segment";
export const INDUSTRY = "Industry (Finnhub)";

/** "Uber Technologies" becomes "Uber Technologies'", "Lyft" becomes "Lyft's". */
export const possessive = (name: string) => (/s$/i.test(name) ? `${name}'` : `${name}'s`);

/** "consumer" reads "Consumer". Null when the company has no segment. */
export const segmentLabel = (s: string | null | undefined): string | null => (s ? s.charAt(0).toUpperCase() + s.slice(1) : null);

type AboutCo = { segment: string | null; size_tier: string | null };
type AboutProfile = { industry?: string | null; website?: string | null; employees?: number | null } | null | undefined;

/** The About rows, label then value. A null value reads "Not available"; the Finnhub industry row is left out when Finnhub has none. */
export function aboutRows(co: AboutCo, p: AboutProfile): [string, string | null][] {
  return [
    [SEGMENT, segmentLabel(co.segment)],
    ...(p?.industry ? [[INDUSTRY, p.industry] as [string, string]] : []),
    ["Size group", co.size_tier ? `${segmentLabel(co.size_tier)} cap` : null],
    ["Website", p?.website ?? null],
    ["Employees", p?.employees == null ? null : p.employees.toLocaleString("en-US")],
  ];
}
