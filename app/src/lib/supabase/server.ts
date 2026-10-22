import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isOffline } from "@/lib/mode";

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            /* called from a server component: ignore */
          }
        },
      },
    }
  );
}

export type Access =
  | { state: "signed_out" }
  | { state: "not_invited"; email: string }
  | { state: "ok"; email: string; role: "admin" | "reviewer" };

// Signed-in users who are not on the allowlist see nothing (RLS also enforces this in the database).
export async function getAccess(): Promise<Access> {
  if (isOffline()) return { state: "ok", email: "offline demo", role: "admin" };
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email;
  if (!email) return { state: "signed_out" };
  // The admin can read every allowlist row, so pick this user's own row by email (case-insensitive), never "the only row".
  const { data: rows } = await supabase.from("allowlist").select("email,role");
  const row = (rows ?? []).find((r: { email: string }) => r.email.toLowerCase() === email.toLowerCase());
  if (!row) return { state: "not_invited", email };
  return { state: "ok", email, role: row.role };
}
