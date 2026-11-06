# Item 22, part 1: why the company tabs are slow (NFR-1)

Report only. No code, config or data was changed. Measured on Nov 6, 2026 (Makassar).

## Answer in one paragraph

The app's server functions run in **Washington, D.C. (Vercel `iad1`)**, and the database is in **Seoul (Supabase `ap-northeast-2`)**. Every database or sign-in check is a round trip of about **0.19 s** across the Pacific; a request on a fresh connection costs about **0.56 s**. Each tab waits for **6 to 8 of these trips one after another** (sign-in check, allowlist, company, links, then prices), and fans out **15 to 17 requests at once** on Who is exposed and the Ecosystem map. The database work itself is tiny (0.1 to 22 ms per query). That is **about 1.9 to 2.6 s per tap before any cold start**. The 5-minute cache covers only Overview's market data and news, so Map and Who is exposed get no help from it. There is no `loading.tsx`, so a tap shows nothing until the whole page is ready. A cold start on the first tap of each tab plausibly adds the rest of your **4.5 to 4.8 s**.

## b. Region

| | Where | Evidence |
|---|---|---|
| Vercel functions | **iad1, Washington, D.C.** (the default; `vercel.json` sets no `regions`) | Response header on gaurberg.vercel.app: `x-vercel-id: sin1::iad1::…` (edge in Singapore, function in iad1) |
| Supabase | **ap-northeast-2, Seoul** | Supabase project settings (`list_projects`) |
| Distance | about **0.19 s per round trip** | Measured through the deployed app, below |

I could not read the Vercel project settings: the CLI is not signed in here. The header shows where the functions actually ran.

**How the round trip was measured.** I timed `/api/indices` on gaurberg.vercel.app with no cookie, and again with a well-formed but invalid sign-in cookie. Both requests return 403 and read no data. The only difference is that the second one makes the function call Supabase Auth once before refusing.

| Request (15 each, interleaved) | Minimum | 25th percentile |
|---|---|---|
| Static file, served by the edge (my network baseline) | 0.17 s | 0.36 s |
| Function, no Supabase call | 0.53 s | 0.63 s |
| Function plus one Supabase Auth call | **1.09 s** | 1.74 s |

- **One Supabase call from iad1 costs about 0.56 s** on a fresh connection: DNS, TCP and TLS handshakes plus the request, about 3 round trips of about 0.19 s each. On an open (warm) connection it is about 0.19 s. AWS us-east-1 to ap-northeast-2 is about 0.18 s in published latency tables, which agrees.
- Getting from the Singapore edge to the iad1 function and back adds about 0.36 s (0.53 − 0.17).
- My own link is slow and noisy (medians were 1.2 to 2.6 s; one connection stalled for 4 s), so I use minimums. From Makassar to Supabase directly: about 0.2 s warm and 1.7 to 5.7 s cold.

## a. Queries per render, and which wait on each other

The structure comes from the code on `main`. Counts are for **Uber, viewed as the admin**: 54 links, 14 linked companies with prices, 5 SEC report dates. "Levels" is how many steps run one after another; each level waits for the one before it.

| Tab | Requests per render | Levels (in sequence) | Widest level | 5-min cache |
|---|---|---|---|---|
| Overview | 13 database or Auth, plus market data (5 outside calls) and news | **6** | 7 | Market data and news only |
| Financials | 3 database or Auth, plus **5 outside calls** (Finnhub and Twelve Data) | **4** | 5 | **None**: calls `getMarket` directly, not `cachedMarket` |
| Earnings | 11 | **6** | 4 | None |
| Ecosystem map | **24** | **8** | **17** | None |
| Who is exposed | **27** | **6** | **17** | None |
| Earnings calendar (`main`) | 5 | **4** | 2 | None |

The steps behind those counts:

- **Every tab starts with the same 3 steps in a row:** `getAccess` makes the Supabase Auth call `auth.getUser()` (1), then reads the allowlist (2); then `getCompany` (3). That is 0.56 to 0.75 s before any tab-specific work. On a full page load the root layout runs `getAccess` again before the page, adding 2 more steps; soft tab navigation skips the layout.
- **Ecosystem map:** steps 1–3, then `recordView` makes **its own** `auth.getUser()` (4), reads `viewed_companies` (5) and writes it (6), and only then `getRels` (7). Then the region data (2 reads) and **co-movement, one price query per linked company (15)**, all at once (8). `recordView` is awaited before the links load, so it adds 3 full round trips to every Map visit.
- **Who is exposed:** steps 1–3; promoted links and all links together (4); upcoming dates, **co-movement (15 price queries)** and the SEC report dates (5); then **4 price queries for the report days**, which need the dates from step 5 (6).
- **Overview:** steps 1–3, then everything at once (step 4). The slowest branches are `recordView` (`getUser`, read, write: 3 levels) and links then nearby moves (2 levels), so the page waits 6 levels in total.
- **Earnings:** steps 1–3; links and events (4); nearby moves and SEC report dates (5); report-day prices (6).
- **Financials:** steps 1–3, then 5 live calls to Finnhub and Twelve Data **on every visit**, with no cache. Their time from iad1 was not measured.
- **Calendar:** steps 1–3, then events and metrics (4). The open PR #102 adds a links-count read *after* that step, so it will be 5 levels; that read can move into step 4.

**Database time is not the problem.** EXPLAIN ANALYZE on the live database, read-only, with row-level security applied as the admin inside a rolled-back transaction:

| Query | Database time |
|---|---|
| Links for Uber with both companies and evidence (`getRels`) | 14 ms with RLS (22 ms without) |
| One company's 400 days of prices (`price_cache`, primary-key index) | 0.2 ms, 261 rows |
| Allowlist | 0.1 ms |

Two small findings, which are not the cause:
- `evidence` has no index on `relationship_id`, so each link scans all of the roughly 1,000 evidence rows (about 0.2 to 0.3 ms per link).
- The RLS policies call `private.is_admin()` and `private.is_allowed()` per row rather than `(select private.is_admin())`, so the check runs once per row instead of once per query.

**Estimated server time per tap** (iad1, 0.19 s per round trip, a fresh connection on the first level, and new connections for a wide fan-out):

| Tab | Levels × 0.19 s | + first connection | + fan-out of 17 new connections | + edge to iad1 | Total |
|---|---|---|---|---|---|
| Ecosystem map | 1.5 s | 0.37 s | 0.37 s | 0.36 s | **about 2.6 s** |
| Who is exposed | 1.1 s | 0.37 s | 0.37 s | 0.36 s | **about 2.2 s** |
| Overview, Earnings | 1.1 s | 0.37 s | – | 0.36 s | about 1.9 s |
| Calendar | 0.75 s | 0.37 s | – | 0.36 s | about 1.5 s |

"First connection" assumes the function's connections to Supabase have closed between taps. Node's `fetch` closes idle connections after 4 s by default, so if you pause between taps, each tap opens new ones. That is likely, but I could not observe it inside Vercel.

## c. Caching, prefetch and loading feedback

- **The 5-minute cache** (`lib/page-cache.ts`, `unstable_cache`) covers only Overview's **market data and news**, the outside calls. It covers nothing on Financials, Earnings, Ecosystem map, Who is exposed or the Calendar. It also cannot cover the sign-in check and allowlist read, which run on every render for every user and are 2 of the 6 to 8 levels.
- **Prefetch:** the tab links (`next/link`) do prefetch, but only a shell of 0.3 to 1.3 kB per tab (measured on a local production build). Each page reads cookies, so no data is prefetched, and the full page is fetched only on the tap.
- **Loading feedback:** there is no `loading.tsx` anywhere in `app/` and no Suspense boundary around the tab content. After a tap, the old page stays on screen, with no indicator, until the whole new page has rendered. That is why a 4.5 s render feels like a dead tap.

## d. Page and script size, and work in the browser

Local production build of `main`, offline sample data (live pages carry more rows):

| Tab | HTML | RSC (page data, uncompressed) | JS (uncompressed, cached after first load) |
|---|---|---|---|
| Overview | 59 kB | 33 kB | 570 kB |
| Financials | 28 kB | 14 kB | 569 kB |
| Earnings | 22 kB | 12 kB | 566 kB |
| Ecosystem map | 96 kB | 53 kB | 849 kB |
| Who is exposed | 85 kB | 49 kB (7.4 kB compressed) | 579 kB |
| Calendar | 23 kB | 13 kB | 565 kB |

- The JavaScript is the same framework bundle on every tab, plus about 280 kB for the map. It loads once and is then cached, so it does not cost anything per tap.
- On a tap, the page data is 7 kB compressed for Who is exposed offline, and about 3 kB in your Network tab.
- **Work in the browser on a tap is negligible.** On Who is exposed (40 rows), selecting a company re-renders in 0.6 ms (median, 20 taps; 2.1 ms at most), and switching between Chart and Table takes 0.3 to 0.5 ms. Every chart point does re-render on each selection, but at this size that costs nothing. The Ecosystem map showed no long tasks on load.

## e. Your Network-tab numbers

Your numbers: Ecosystem map about 4.51 s, Who is exposed about 4.84 s, each for about 3 kB, on the first tap of each tab.

- **A tiny payload with a long wait means server time.** The page data and the browser work above are too small to matter, so you are right to look at the server.
- **A fixed cost shared by every tab.** Every tab pays the same three serial trips to Seoul first: Auth, allowlist, company (0.56 to 0.75 s, more on a fresh connection). Map pays three more (`recordView`'s own Auth call, then its read and write), and both tabs fan out to 17 parallel requests.
- **Explained so far:** the distance between iad1 and Seoul, times 6 to 8 serial levels, gives about 2.2 to 2.6 s per tap even on a warm function.
- **The remaining 2 to 2.5 s:** most likely a **cold start** of the server function on the first tap of each tab. Your numbers are for first taps, and my no-cookie probe ranged from 0.53 s to 2.5 s, which fits occasional cold starts. I could not measure cold starts inside Vercel directly, so this part is an inference.
- **Why the cache does not hide it:** neither tab has anything cached, and the sign-in and allowlist reads can't be cached across users.
- **Why it feels dead:** with no loading state, nothing changes on screen for the full 4.5 s.
- Map and Who is exposed costing about the same fits the model: Map has more serial levels (8) but Who is exposed makes more requests (27), and both have the same 17-wide fan-out.

**Ranked causes:**
1. **Function region iad1, database in Seoul:** about 0.19 s per trip, times 6 to 8 serial trips per tab.
2. **Serial work at the start of every render:** Auth, allowlist and company on every tab, plus `recordView` (its own Auth call, read and write) blocking the Map before its links load.
3. **No loading state:** a tap shows nothing for the full render.
4. **Cold starts on first taps** (inferred, not measured).
5. **No caching** on Map, Who is exposed, Earnings, Financials or the Calendar, with Financials making 5 live outside calls on every visit.

## What I could not verify

- **Real per-query timings inside Vercel.** I couldn't sign in (I won't enter your credentials), so I couldn't run the deployed pages myself. The per-tab numbers are the code's query structure times a round trip measured through the deployed app. The database times are real.
- **Overview's timing log.** Overview already writes one timing line per load to the server log (`timed(...)` in `company/[ticker]/page.tsx`). Its real numbers in the Vercel logs would confirm or correct the model; I can't read the logs here.
- **Cold starts**, and how long Node keeps idle connections to Supabase open inside Vercel.
- **The Vercel project settings.** The region comes from the response header instead.
- **How long Finnhub and Twelve Data take from iad1** (Financials).
- **Production Overview and Map pages.** I didn't load them: each visit writes a `viewed_companies` row, and this item allows no database writes.

## Method

Nothing here was committed except this file.
- **Deployed app:** `curl` timings against gaurberg.vercel.app (`/icon.svg`, `/api/indices` with and without an invalid sign-in cookie; every call returned 403 and read no data).
- **Database:** read-only `EXPLAIN ANALYZE` through the Supabase connector, with RLS applied as the admin inside a rolled-back transaction, plus row counts and index and policy listings.
- **Browser side:** a local production build of `main` with `DEMO_OFFLINE=1`, measured in the in-app browser (sizes, prefetch requests, selection timing, long tasks).
- **Query structure:** read from `app/src` on `main` (6eb52b8).

Possible fixes are not in this report. I'll propose them only after your go-ahead.
