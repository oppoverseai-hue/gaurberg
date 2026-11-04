import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every company screen lives under /company/<TICKER>/ (UX-10). Old map links keep working.
  async redirects() {
    return [{ source: "/map/:ticker", destination: "/company/:ticker/map", permanent: true }];
  },
};

export default nextConfig;
