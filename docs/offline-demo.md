# Offline demo mode (DEM-1)

For the dry run on your own laptop with the network off. Not for the hosted app: it is refused when `VERCEL` is set.

1. While online, once, in `app/`: `node --env-file=.env scripts/save-market.mjs` (needs FINNHUB_API_KEY and TWELVEDATA_API_KEY). It writes `app/data/market/<TICKER>.json` for every mapped company. It waits between history calls because Twelve Data's free plan allows 8 per minute, so a full run takes a while; pass tickers to do a few: `... save-market.mjs UBER LYFT CRWV`.
2. You can also type data by hand. Copy `app/data/market/TEMPLATE.json.txt` to `app/data/market/UBER.json`, fill what you have, set `"source": "manual"`. The page labels it "provided by admin". About text and employees are only available this way: Finnhub's free plan does not have them.
3. The graph (companies, promoted links, quotes) is in `app/data/snapshot.json`. Refresh it after any promotion.
4. Run: `cd app && npm run build && DEMO_OFFLINE=1 npm start`. Sign-in is skipped in this mode and a banner says "Offline: showing saved data".

If a live call fails in the normal app, the page falls back to the same saved files and says so; without a saved file it shows "Data unavailable: <reason>".
