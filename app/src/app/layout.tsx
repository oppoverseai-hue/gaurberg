import "./globals.css";
export const metadata = { title: "Gaurberg", description: "Company pages and ecosystem maps for independent analysts" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" />
      </head>
      <body>
        <header className="sitebar">
          <a className="brand" href="/">Gaurberg</a>
          <nav><a href="/">Search</a><a href="/sources">Sources</a></nav>
        </header>
        {children}
        <footer className="site"><div className="in">
          <span>Company links come from SEC filings; prices from Finnhub (delayed). Links not yet reviewed are tagged Staged.</span>
          <span>·</span><a href="/sources">Sources</a><span>·</span><span>Not investment advice.</span>
        </div></footer>
      </body>
    </html>
  );
}
