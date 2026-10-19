import "server-only";
import { isDemoMode } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Increment an aggregate daily counter. No user identifiers are stored. */
export async function recordMetric(itemId: string, kind: "preview_views" | "reader_opens" | "product_views") {
  if (isDemoMode()) return;
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.rpc("record_content_metric", { p_item: itemId, p_kind: kind });
  } catch {
    // Metrics are best-effort and must never break a page.
  }
}
