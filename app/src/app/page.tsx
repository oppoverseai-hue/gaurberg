import { getAccess } from "@/lib/supabase/server";
import LoginButton from "@/components/LoginButton";
import LandingSearch from "@/components/LandingSearch";
import IndexTicker from "@/components/IndexTicker";
import RequestAccess from "@/components/RequestAccess";

export const dynamic = "force-dynamic";

export default async function Home() {
  const access = await getAccess();
  return (
    <main className="narrow hero">
      <h1>Gaurberg</h1>
      <p className="muted">Research any company through the businesses around it.</p>
      {access.state === "signed_out" && (
        <div className="card">
          <p>Gaurberg is in early access. Continue with Google: invited accounts go straight in, everyone else can request an invitation.</p>
          <LoginButton />
        </div>
      )}
      {access.state === "not_invited" && <RequestAccess email={access.email} />}
      {access.state === "ok" && (
        <>
          <LandingSearch />
          <IndexTicker />
        </>
      )}
    </main>
  );
}
