"use client";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function LoginButton() {
  return (
    <button
      className="btn"
      onClick={() =>
        supabaseBrowser().auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${window.location.origin}/auth/callback`, queryParams: { prompt: "select_account" } },
        })
      }
    >
      Continue with Google
    </button>
  );
}
