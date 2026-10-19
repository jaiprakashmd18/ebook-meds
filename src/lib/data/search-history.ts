import "server-only";
import { isDemoMode } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SessionUser } from "@/lib/auth/session";

/**
 * Record a search: an anonymous aggregate (no user id) for analytics, and the
 * user's personal history only if they opted in.
 */
export async function recordSearch(user: SessionUser | null, query: string, resultCount: number) {
  if (isDemoMode() || !query.trim()) return;
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.rpc("record_search_query", { p_query: query, p_result_count: resultCount });
    if (user) {
      const { data: prefs } = await supabase
        .from("notification_preferences")
        .select("search_history_enabled")
        .eq("user_id", user.id)
        .maybeSingle();
      if (prefs?.search_history_enabled) {
        await supabase.from("search_history").insert({ user_id: user.id, query: query.slice(0, 200) });
      }
    }
  } catch (e) {
    console.error("[search] failed to record search", e instanceof Error ? e.message : e);
  }
}

export async function getSearchHistory(user: SessionUser | null): Promise<string[]> {
  if (isDemoMode() || !user) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("search_history")
    .select("query, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);
  return [...new Set((data ?? []).map((r) => r.query as string))].slice(0, 6);
}
