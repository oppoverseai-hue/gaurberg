import { getAccess } from "@/lib/supabase/server";
import LandingSearch from "@/components/LandingSearch";
import IndexTicker from "@/components/IndexTicker";
import Landing from "@/components/landing/Landing";

export const dynamic = "force-dynamic";

// Home: invited people get search and the index ticker (TRM-1); everyone else gets the public landing page (ACC-7),
// with the request-access form in place of the Google button once they have signed in (ACC-5).
export default async function Home() {
  const access = await getAccess();
  if (access.state !== "ok") return <Landing state={access.state} email={access.state === "not_invited" ? access.email : undefined} />;
  return (
    <main className="narrow hero">
      <h1>Gaurberg</h1>
      <p className="muted">Research any company through the businesses around it.</p>
      <LandingSearch />
      <IndexTicker />
    </main>
  );
}
