import "./globals.css";
import { isOffline } from "@/lib/mode";
import { getAccess } from "@/lib/supabase/server";
import AccountMenu from "@/components/AccountMenu";
export const metadata = { title: "Gaurberg", description: "Company pages and ecosystem maps for independent analysts" };
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const access = isOffline() ? null : await getAccess().catch(() => null);
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=JetBrains+Mono:wght@400;500;700&display=swap" />
      </head>
      <body>
        {isOffline() && <div className="offbar" role="status">Offline: showing saved data</div>}
        <header className="sitebar">
          <a className="brand" href="/">Gaurberg</a>
          <form className="cmd" action="/go" method="get" role="search">
            <input name="q" type="search" placeholder="Company or ticker, plus a word: Uber, Uber chart, Uber map, help" aria-label="Command bar" autoComplete="off" />
          </form>
          <nav><a href="/help">Help</a><a href="/screener">Screener</a><a href="/connect">Connect</a><a href="/calendar">Calendar</a><a href="/sources">Sources</a><a href="/hood">Under the hood</a>{access?.state === "ok" && <AccountMenu email={access.email} role={access.role} />}</nav>
        </header>
        {children}
        <footer className="site"><div className="in">
          <span>Links not yet reviewed are tagged Staged.</span>
          <span>·</span><a href="/sources">Sources</a><span>·</span><span>Not investment advice.</span>
        </div></footer>
      </body>
    </html>
  );
}
