// Company page cache (NFR-1). The page renders per request, because it checks the viewer and reads rows under row-level security,
// and that makes every fetch on it uncached. The outside calls (Finnhub, Twelve Data, SEC news) are the slow part and are the same
// for every viewer, so their results are kept for 5 minutes per listing. Nothing user-specific goes in here.
// unstable_cache is the Next 16 API for this without turning on cacheComponents app-wide (its successor, "use cache", needs that).
import { unstable_cache } from "next/cache";
import { getMarket } from "@/lib/market";
import { getNews } from "@/lib/news";
import type { Listing } from "@/lib/listing";
import type { NewsCo } from "@/lib/news-core";

export const PAGE_CACHE_S = 300;
const key = (co: Listing) => [co.ticker ?? "", (co.markets ?? []).join(",")];

export const cachedMarket = (co: Listing) => unstable_cache(() => getMarket(co), ["company-market", ...key(co)], { revalidate: PAGE_CACHE_S })();
export const cachedNews = (co: Listing & NewsCo) => unstable_cache(() => getNews(co), ["company-news", ...key(co)], { revalidate: PAGE_CACHE_S })();
