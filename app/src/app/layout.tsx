import "./globals.css";
export const metadata = { title: "Gaurberg", description: "Company pages and ecosystem maps for independent analysts" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}<footer className="site">Company links come from SEC filings; prices from Finnhub (delayed). Links not yet reviewed are tagged Staged. <a href="/sources">Sources</a> · Not investment advice.</footer></body>
    </html>
  );
}
