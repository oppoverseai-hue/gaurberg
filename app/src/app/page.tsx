import { getAccess } from "@/lib/supabase/server";
import LoginButton from "@/components/LoginButton";
import LandingSearch from "@/components/LandingSearch";
import IndexTicker from "@/components/IndexTicker";

export const dynamic = "force-dynamic";

export default async function Home() {
  const access = await getAccess();
  return (
    <main className="narrow hero">
      <h1>Gaurberg</h1>
      <p className="muted">Research any company through the businesses around it.</p>
      {access.state === "signed_out" && (
        <div className="card">
          <p>This is an invite-only prototype. Sign in with the Google account you were invited with.</p>
          <LoginButton />
        </div>
      )}
      {access.state === "not_invited" && (
        <div className="card">
          <p>{access.email} is not on the invite list yet. Ask the admin to add it, then sign in again.</p>
          <form action="/auth/signout" method="post"><button className="btn">Sign out</button></form>
        </div>
      )}
      {access.state === "ok" && (
        <>
          <LandingSearch />
          <div className="who muted mono">{access.email} ({access.role}){access.role === "admin" && <> · <a href="/admin">Admin</a></>} · <form action="/auth/signout" method="post" style={{ display: "inline" }}><button className="linkbtn">Sign out</button></form></div>
          <IndexTicker />
        </>
      )}
    </main>
  );
}
