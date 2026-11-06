# Item 24: the fixed cost per request, before and outside page code (NFR-1)

Report only. No code, config, data or auth behaviour was changed. Measured on Nov 6, 2026.

## First: #106 is not in production

#105 was merged into main at 03:14:14 UTC. #106 was merged 96 seconds later, at 03:15:50, into its base branch `m64-region-icn1`. That branch had already been merged, so **none of #106 reached main or gaurberg.vercel.app.**

The admin's "after #105 and #106" numbers are therefore **#105 only**:
- the functions are in Seoul;
- the `[timing]` lines are in;
- the sign-in check, allowlist and company lookup still run one after another;
- the Map still awaits its "viewed" write;
- Financials still makes 5 live outside calls on every visit;
- there is no loading frame.

**#107** lands #106 on main unchanged (a clean cherry-pick). #108 and #109 include it too, and their base is main, so this can't happen again.

## 1. Proxy or middleware

**There is none.** `app/src/proxy.ts` and `app/src/middleware.ts` don't exist on main or in #107. So no code runs in front of the pages, and nothing calls Supabase before the page code. That includes prefetch and RSC requests.

What runs on each kind of request today (main = #105). I checked locally with temporary log lines in the root layout and a page; nothing was committed.

| Request | Our code that runs | Network calls, in order |
|---|---|---|
| **Prefetch** of a tab or link (0.1–0.8 kB) | **None.** Neither the root layout nor the page ran for a prefetch request. | **None** |
| **Tab tap** (RSC navigation) | The page only; the root layout is not re-run | Tab-specific, below |
| **Full page load** (first visit, refresh) | Root layout, then the page | Layout: Auth `getUser`, then allowlist. Then the page's own sequence |

Page sequence on main, for example Who is exposed:
1. Auth `getUser`.
2. Allowlist read.
3. Company read.
4. Promoted links and all links, at once.
5. Upcoming dates, 15 price reads and the SEC dates, at once.
6. 4 report-day price reads.

Other tabs are listed in #104. With #107 every tab starts with **one** step instead of three (Auth, allowlist and company together), and the layout and page share one check.

## Production measurements (gaurberg.vercel.app, icn1)

From Makassar, 15 interleaved rounds, with `curl` time to first byte. Every request returned 403 or a prefetch tree and read no data. Minimums and 25th percentiles; my connection is noisy, so the medians are not usable.

| Request | Min | p25 | What it shows |
|---|---|---|---|
| Static file (served by the edge) | 0.13 s | 0.63 s | my network to the Singapore edge |
| Function that does no work (`/api/indices`, no cookie) | 0.23 s | 0.30 s | edge → icn1 function → back, plus invocation |
| The same plus one Supabase Auth call (invalid session cookie) | 0.28 s | 0.37 s | **one Auth call ≈ 0.05 s** (it was 0.56 s from iad1) |
| Prefetch of `/company/UBER/exposure` (347 bytes), no cookie | 0.23 s | 0.31 s | **the same as a function that does nothing** |
| The same prefetch with a session cookie | 0.26 s | 0.38 s | no Auth call (within noise) |

**Prefetch shells (250–820 ms for the admin):** our code does nothing for a prefetch. The time is the platform path: the admin's network to the Singapore edge, the hop to the icn1 function and back, and the function invocation. From here that path is at least 0.23 s; 820 ms points to a cold function or a slow moment on the network. Auth is not involved.

## 2. getClaims, and skipping the Auth call for prefetches

- **Skipping the call for prefetches:** not needed. Prefetches already make no Auth call.
- **getClaims instead of getUser:**
  - The project publishes an **ES256** signing key (`/auth/v1/.well-known/jwks.json`: `alg ES256, kty EC, crv P-256`). With ES256 tokens, `supabase.auth.getClaims()` (auth-js 2.118) checks the token's signature and expiry locally against the cached key, with no network call. With older HS256 tokens it quietly falls back to `getUser()`.
  - Before relying on it, confirm in the Supabase dashboard (Authentication → JWT Keys) that ES256 is the **current** signing key, not only a standby key.
  - **Safe for our role checks?** Yes, as long as the allowlist read stays on every request.
    - The role never comes from the token. It comes from the `allowlist` table, read under RLS on every request, and RLS checks the token again in the database.
    - The one thing lost is that `getUser` asks the Auth server whether the session still exists. With `getClaims`, a session that was signed out elsewhere, or a deleted user, stays valid until the access token expires (1 hour by default).
    - Removing someone from the allowlist still takes effect on their next request.
  - **Saving at icn1:** one Auth call, about **0.05 s** per render on main, where it runs first and alone. With #107 it runs alongside the allowlist and company reads, so the saving on the critical path is only the extra time Auth takes over those reads, about **0.02–0.05 s**.
  - **Risk: low.** Estimate **0.3 Claude Code hour**, with tests: falls back correctly, rejects an expired or forged token, and the role still comes from the allowlist.

## 3. Other work on every request before the page

- **Cookie refresh:**
  - No proxy or middleware refreshes the session cookie.
  - When the access token has expired (after about an hour), `getUser` inside the page render refreshes it with one more Auth call (about 0.05 s).
  - A page can't save cookies: `setAll` in `lib/supabase/server.ts` swallows the error. So the new token is not saved, and **every render after expiry refreshes again** until a route handler saves it. The ones that can are Home's `/api/indices` (polled every 5 minutes, Home only), the Map's headline route and the sign-in callback.
  - Supabase rotates refresh tokens. Reusing an already-used refresh token more than 10 seconds later counts as reuse, and the session can be revoked, which would look like a random sign-out after a long stay on company pages.
  - **Not verified:** I can't sign in, and the admin hasn't reported sign-outs.
  - Supabase's documented fix for server-rendered apps is a `proxy.ts` (middleware) that refreshes and saves the cookie once per request.
- **Logging writes:** none before the page. The `[timing]` and `[company]` lines are console output only.
- **The "viewed" row:** on main, the Map awaits its read and write (plus its own `getUser`) before loading links, and Overview runs it alongside its other reads. That is 3 more calls on the Map. #107 moves it after the response.
- Nothing else runs per request: no analytics, no rate-limit check, no lookup logging outside the live-lookup feature.

## Where the 0.6–0.8 s between "navigation" and `[timing]` goes

The admin measured navigations of 1.1–1.45 s against server times of 0.31–0.73 s.
- **Platform path for every request: about 0.25–0.4 s.** This is the admin's network to the Singapore edge, the edge to icn1 and back, and the function invocation. It is the same path as a prefetch shell (0.25 s at best from both the admin and me), and our code can't remove it.
- **The rest (about 0.3–0.5 s) is not explained by the code.** Likely causes, none of them measurable from here:
  - a cold function on the first tap of a tab (#104 suggested this for the iad1 numbers too);
  - the RSC response streaming over the admin's link;
  - a tap with no loading frame keeps the old page until the last byte, which makes everything feel as long as the slowest part.
- **To pin it down**, the admin can open one navigation in the Network tab and read "Waiting for server response" (time to first byte) and "Content download". Time to first byte minus that request's `[timing]` total is the platform-and-network part. If it is much larger on the first tap than on the second, it is a cold start. Vercel's project settings also show whether Fluid compute is on, which keeps functions warm.

## Proposed fixes, in order

| # | Fix | Saves (icn1) | Risk | Estimate |
|---|---|---|---|---|
| 1 | **Merge #107** (lands #106): one parallel start, "viewed" row after the response, loading frames, Financials cache | Financials: the 5 outside calls on a cache hit (most of its 0.73 s); 2 of the 3 opening steps on every tab; 3 steps on the Map; **immediate feedback on every tap** | Low (already reviewed as #106) | 0 h |
| 2 | **Merge #109**: no prefetch for company links in long lists | Fewer background requests (7 or more company pages per Calendar view) | Low | 0 h |
| 3 | `getClaims` instead of `getUser` in `getAccess` (allowlist still read every request) | ~0.02–0.05 s per render | Low (sessions revoked elsewhere stay valid until the token expires, ≤1 h; access is still revoked at once via the allowlist) | 0.3 h |
| 4 | A small `proxy.ts` that refreshes and saves the session cookie only when it has expired, matched to page routes and not to prefetches or static files | Removes the repeated refresh call after expiry (~0.05 s per render) and the refresh-token reuse risk | Medium (changes how sign-in cookies are written; needs a signed-in test) | 0.5 h |
| 5 | Measure the remaining gap: one Network-tab timing breakdown plus the matching `[timing]` line, first and second tap; check Fluid compute | Shows whether cold starts are the rest | None | 0.1 h (admin) |

I recommend 1 and 2 now. 3 and 4 change auth behaviour, so they need your approval, and I'd do them together in one PR with a signed-in test on a preview. 5 is the check that tells us whether anything beyond that is worth doing.

## What I could not verify

- Anything signed in on production: real `[timing]` breakdowns, the refresh-on-expiry behaviour, and whether the sign-outs it could cause happen.
- That ES256 is the **current** signing key, not only published.
- Cold starts in icn1, and how the admin's network contributes.
- The local check (no app code runs for a prefetch) was on a local production build of main; production behaved the same in the timing probe, but I can't see its logs.

## Method

- Code read on main (a3946c8) and #107.
- Temporary `console.info` lines in the root layout and the Who is exposed page in a local production build (offline mode), removed and not committed.
- `curl` probes against gaurberg.vercel.app (403 responses and prefetch trees, no data read).
- The public JWKS endpoint, read once.
