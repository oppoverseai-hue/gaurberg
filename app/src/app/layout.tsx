import "./globals.css";
import { isOffline } from "@/lib/mode";
import { getAccess } from "@/lib/supabase/server";
import AccountMenu from "@/components/AccountMenu";
import SourceCapture from "@/components/SourceCapture";
import Logo from "@/components/Logo";
import AppChrome from "@/components/AppChrome";
// Top bar links. Desktop shows them in a row; under 600 px they sit behind one Menu button so the bar stays one row (UX-9).
const LINKS = [["/help", "Help"], ["/screener", "Screener"], ["/connect", "Connect"], ["/calendar", "Calendar"], ["/sources", "Sources"], ["/hood", "Under the hood"]] as const;
export const metadata = { title: "Gaurberg · Every stock has an ecosystem", description: "Gaurberg maps who supplies, buys from, partners with, competes with and invests in a company, with the filing sentence behind every link." };
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const access = isOffline() ? null : await getAccess().catch(() => null);
  // The app's top bar and footer are for invited users; the public landing page brings its own (ACC-7).
  const chrome = isOffline() || access?.state === "ok";
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500&family=JetBrains+Mono:wght@400;500;700&display=swap" />
      </head>
      <body>
        <SourceCapture />
        {isOffline() && <div className="offbar" role="status">Offline: showing saved data</div>}
        {chrome && (
        <AppChrome>
        <header className="sitebar">
          <a className="brand" href="/" aria-label="Gaurberg home"><Logo tone="dark" size={20} /></a>
          <form className="cmd" action="/go" method="get" role="search">
            <input name="q" type="search" placeholder="Company or ticker, plus a word: Uber, Uber chart, Uber map, help" aria-label="Command bar" autoComplete="off" />
          </form>
          <div className="sitebar-r">
            <nav className="navlinks">{LINKS.map(([h, l]) => <a key={h} href={h}>{l}</a>)}</nav>
            <details className="navmenu">
              <summary aria-label="Menu">Menu</summary>
              <nav>{LINKS.map(([h, l]) => <a key={h} href={h}>{l}</a>)}</nav>
            </details>
            {access?.state === "ok" && <AccountMenu email={access.email} role={access.role} />}
          </div>
        </header>
        </AppChrome>
        )}
        {children}
        {chrome && (
        <AppChrome>
        <footer className="site"><div className="in">
          <span>Unreviewed links are labelled.</span>
          <span>·</span><a href="/sources">Sources</a><span>·</span><span>Not investment advice.</span>
        </div></footer>
        </AppChrome>
        )}
      </body>
    </html>
  );
}
