// The one gate for live market-data calls (DEM-3, TRM-9). No imports, so scripts and tests can use it directly.
// Finnhub, Twelve Data and SEC EDGAR look companies up by bare ticker, which only identifies a US listing: "CCC" is
// Computacenter in London but CCC Intelligent Solutions on Nasdaq. So live calls are made only for a company whose
// primary market (the first in companies.markets) is US; every other company gets saved data or a plain message.
export type Listing = { ticker: string | null; markets?: string[] | null };

export const isUSListed = (markets: string[] | null | undefined) => (markets ?? [])[0] === "US";

/** The symbol to send to a live US data service, or null when this company must not be looked up live. */
export function liveSymbol(co: Listing): string | null {
  return co.ticker && isUSListed(co.markets) ? co.ticker : null;
}

export const NOT_LIVE_PRICE = "Live price not available for this listing.";
export const NOT_LIVE_DATA = "Live data covers US-primary listings only.";
