import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv, getServerEnv } from "@/lib/env";

let client: SupabaseClient | null = null;

/**
 * Service-role client. Bypasses Row Level Security, so it must only be used
 * in trusted server code AFTER the caller's authorization has been checked:
 * webhooks, entitlement-checked content delivery and signed download URLs.
 * Never import this from a Client Component.
 */
export function createSupabaseAdminClient(): SupabaseClient {
  if (client) return client;
  const key = getServerEnv().SUPABASE_SECRET_KEY;
  if (!publicEnv.supabaseUrl || !key) {
    throw new Error("SUPABASE_SECRET_KEY is not configured");
  }
  client = createClient(publicEnv.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}

export function isAdminClientConfigured(): boolean {
  return Boolean(publicEnv.supabaseUrl && getServerEnv().SUPABASE_SECRET_KEY);
}
