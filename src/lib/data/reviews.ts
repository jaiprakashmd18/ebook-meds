import "server-only";
import { isDemoMode } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SessionUser } from "@/lib/auth/session";

export type PublicReview = {
  id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  author: string;
};

export async function getApprovedReviews(itemId: string): Promise<PublicReview[]> {
  if (isDemoMode()) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("reviews")
    .select("id, rating, review_text, created_at")
    .eq("content_item_id", itemId)
    .eq("moderation_status", "approved")
    .order("created_at", { ascending: false })
    .limit(20);
  // Reviewer identities are not exposed publicly; reviews are shown as
  // from a verified reader.
  return (data ?? []).map((r) => ({ ...(r as Omit<PublicReview, "author">), author: "Verified reader" }));
}

export type MyReviewState =
  | { kind: "signed_out" }
  | { kind: "not_eligible" }
  | { kind: "eligible" }
  | { kind: "reviewed"; rating: number; review_text: string | null; moderation_status: string };

export async function getMyReviewState(user: SessionUser | null, item: { id: string; is_free: boolean }): Promise<MyReviewState> {
  if (isDemoMode() || !user) return { kind: "signed_out" };
  const supabase = await createSupabaseServerClient();
  const { data: mine } = await supabase
    .from("reviews")
    .select("rating, review_text, moderation_status")
    .eq("content_item_id", item.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (mine) return { kind: "reviewed", ...(mine as { rating: number; review_text: string | null; moderation_status: string }) };

  if (item.is_free) {
    const { data: progress } = await supabase
      .from("reading_progress")
      .select("id")
      .eq("content_item_id", item.id)
      .eq("user_id", user.id)
      .maybeSingle();
    return progress ? { kind: "eligible" } : { kind: "not_eligible" };
  }
  const { data: purchases } = await supabase
    .from("purchases")
    .select("product_id")
    .eq("user_id", user.id)
    .eq("access_status", "active");
  const owned = new Set((purchases ?? []).map((p) => p.product_id as string));
  if (owned.has(item.id)) return { kind: "eligible" };
  if (owned.size) {
    const { data: bundles } = await supabase.from("bundle_items").select("bundle_id").eq("content_item_id", item.id);
    if ((bundles ?? []).some((b) => owned.has(b.bundle_id as string))) return { kind: "eligible" };
  }
  return { kind: "not_eligible" };
}
