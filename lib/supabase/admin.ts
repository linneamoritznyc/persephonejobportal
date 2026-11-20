/**
 * Service-key Supabase client for server work that must bypass RLS
 * (cron agent, seeding). Never import into client components.
 * Adapted from vetlandajobb lib/supabase/admin.ts.
 */
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let admin: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (!admin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Supabase is not configured");
    admin = createClient(url, key, { auth: { persistSession: false } });
  }
  return admin;
}
