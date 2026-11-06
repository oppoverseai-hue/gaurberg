// Offline demo mode (DEM-1): run the app from saved data with the network off.
// Only for a local run: it is refused on Vercel, and it skips sign-in because the sign-in service is not reachable offline.
export const isOffline = () => process.env.DEMO_OFFLINE === "1" && !process.env.VERCEL;

// Local development only: false in any production build (NODE_ENV=production, which includes `next start`) and on Vercel, whatever
// else the environment says. The offline demo above is kept for `npm start` (docs/offline-demo.md) and is refused on Vercel only.
export const isLocalDev = () => process.env.NODE_ENV !== "production" && !process.env.VERCEL;

// Every DEV_* screenshot and fixture switch is read through here, never from process.env directly: outside local development it
// reads as unset, even when the variable is present (item 25).
export const DEV_SWITCHES = ["DEV_CALENDAR_FIXTURE", "DEV_CALENDAR_ROLE", "DEV_AROUND_FIXTURE", "DEV_REACTION_FIXTURE", "DEV_NEWS_FIXTURE", "DEV_MAP_FIXTURE"] as const;
export type DevSwitch = (typeof DEV_SWITCHES)[number];
export const devSwitch = (name: DevSwitch): string | undefined => (isLocalDev() ? process.env[name] || undefined : undefined);
