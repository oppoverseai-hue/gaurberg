// News link handling (TRM-7). Pure functions, no network call: they only classify and build addresses.
// The data service's own news links (its /api/news?id=... address) redirect to the publisher and can hang in the browser,
// so those go through our /api/news-go route, which follows the redirect on the server.
const FH_NEWS = /^https:\/\/finnhub\.io\/api\/news\?id=[\w-]+$/;
export const isFinnhubNewsUrl = (u: string): boolean => FH_NEWS.test(u);

/** Where a reader lands when the publisher's address cannot be found: a web search for the headline, never a spinner. */
export function fallbackSearchUrl(headline: string, source: string): string {
  const q = `${headline} ${source}`.replace(/\s+/g, " ").trim().slice(0, 200);
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

/** The address a news card links to: our redirect route for the data service's links, the original address for everything else (SEC filings). */
export function newsHref(url: string, headline: string, source: string): string {
  if (!isFinnhubNewsUrl(url)) return url;
  return `/api/news-go?${new URLSearchParams({ u: url, h: headline.slice(0, 160), s: source.slice(0, 60) })}`;
}
