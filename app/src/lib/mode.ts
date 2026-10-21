// Offline demo mode (DEM-1): run the app from saved data with the network off.
// Only for a local run: it is refused on Vercel, and it skips sign-in because the sign-in service is not reachable offline.
export const isOffline = () => process.env.DEMO_OFFLINE === "1" && !process.env.VERCEL;
