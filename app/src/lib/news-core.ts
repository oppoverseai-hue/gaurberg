// News relevance (TRM-4). Pure functions, no network call. The news service files general market stories under a company's
// ticker ("3 Stocks to Watch Heading Into Wednesday" under UBER), so a headline counts as company news only when it names the
// company or its ticker; the rest is shown apart as "Market news", never dropped. SEC filings are the company's own and always count.

export type NewsCo = { name: string; ticker: string | null; aliases?: string[] | null };

// Endings that a headline usually leaves out: "Uber Technologies" is written "Uber", "Nebius Group" "Nebius".
const ENDING = /\s+(technologies|technology|platforms|group|systems|holdings|inc\.?|corp\.?|corporation|limited|ltd\.?|plc)$/i;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Every name a headline may use for the company: its name and aliases, each also without one legal ending. */
export function namesFor(co: NewsCo): string[] {
  const out = new Set<string>();
  const add = (n: string | null | undefined) => { const t = n?.trim(); if (t && t.length >= 2) out.add(t); };
  // Each name also without one ending: "Bytes Technology Group" gives "Bytes Technology", never "Bytes"; the alias
  // "Neutron Holdings" gives "Neutron".
  for (const n of [co.name, ...(co.aliases ?? [])]) { add(n); add(n.trim().replace(ENDING, "")); }
  return [...out];
}

/** True when the headline names the company (any of namesFor, any case, as a whole word) or its ticker (exact case, as a whole
 *  token, also "$UBER", "(NET)", "NASDAQ:LIME"). The ticker is matched in capitals only, so "net" and "grab" do not count. */
export function namesCompany(headline: string, co: NewsCo): boolean {
  const edge = (s: string) => `(?<![\\p{L}\\p{N}])${s}(?![\\p{L}\\p{N}])`;
  if (co.ticker && new RegExp(edge(`\\$?${esc(co.ticker)}`), "u").test(headline)) return true;
  return namesFor(co).some((n) => new RegExp(edge(esc(n)), "iu").test(headline));
}

/** Splits a company's feed into company news (names it, or an SEC filing) and market news (everything else), order kept. */
export function splitNews<T extends { kind: string; headline: string }>(items: T[], co: NewsCo): { company: T[]; market: T[] } {
  const company: T[] = [], market: T[] = [];
  for (const i of items) (i.kind === "filing" || namesCompany(i.headline, co) ? company : market).push(i);
  return { company, market };
}
