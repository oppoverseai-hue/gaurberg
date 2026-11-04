// Server-only Supabase client with the service-role key, for scheduled jobs that write market data (the daily refresh)
// and the waitlist. Never import this from a page or a client component. The key lives only in Vercel's server env.
import { createClient } from "@supabase/supabase-js";

export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
