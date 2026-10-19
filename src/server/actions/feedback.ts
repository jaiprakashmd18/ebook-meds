"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { isDemoMode } from "@/lib/env";
import { assertUser, AuthorizationError } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResult } from "./types";

const reviewSchema = z.object({
  contentItemId: z.uuid(),
  slug: z.string().max(100),
  rating: z.coerce.number().int().min(1, "Choose a rating").max(5),
  reviewText: z.string().trim().max(3000).optional(),
});

export async function submitReview(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (isDemoMode()) return { ok: false, error: "Reviews are unavailable in demo mode." };
  const parsed = reviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid review" };
  try {
    const user = await assertUser();
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("reviews").upsert(
      {
        user_id: user.id,
        content_item_id: parsed.data.contentItemId,
        rating: parsed.data.rating,
        review_text: parsed.data.reviewText || null,
      },
      { onConflict: "user_id,content_item_id" },
    );
    if (error) {
      // RLS rejects users who have not purchased or read the item.
      return { ok: false, error: "Only readers who own or have read this title can review it." };
    }
    revalidatePath(`/notes/${parsed.data.slug}`);
    return { ok: true, message: "Thanks! Your review will appear after moderation." };
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, error: e.message };
    return { ok: false, error: "Could not save your review. Please try again." };
  }
}

const reportSchema = z.object({
  contentItemId: z.uuid(),
  sectionId: z.string().regex(/^[a-z0-9-]{1,64}$/).optional().or(z.literal("")),
  reviewId: z.uuid().optional().or(z.literal("")),
  kind: z.enum(["inaccuracy", "unclear", "typo", "feedback", "review_abuse", "other"]),
  message: z.string().trim().min(5, "Please describe the issue (at least 5 characters)").max(4000),
  difficultyRating: z.coerce.number().int().min(1).max(5).optional().or(z.literal("")),
});

export async function submitContentReport(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (isDemoMode()) return { ok: false, error: "Reporting is unavailable in demo mode." };
  const parsed = reportSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid report" };
  try {
    const user = await assertUser();
    const supabase = await createSupabaseServerClient();
    const { data: item } = await supabase
      .from("content_items")
      .select("current_version_id")
      .eq("id", parsed.data.contentItemId)
      .maybeSingle();
    const { error } = await supabase.from("content_reports").insert({
      user_id: user.id,
      content_item_id: parsed.data.contentItemId,
      content_version_id: item?.current_version_id ?? null,
      section_id: parsed.data.sectionId || null,
      review_id: parsed.data.reviewId || null,
      kind: parsed.data.kind,
      message: parsed.data.message,
      difficulty_rating: parsed.data.difficultyRating === "" ? null : parsed.data.difficultyRating ?? null,
    });
    if (error) return { ok: false, error: "Could not send your report. Please try again." };
    return { ok: true, message: "Thank you. Our editors will review your report." };
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, error: e.message };
    return { ok: false, error: "Could not send your report. Please try again." };
  }
}
