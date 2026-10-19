"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertUser, AuthorizationError } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { passwordSchema } from "@/lib/validation/auth";
import { isSubscriptionAvailable } from "@/lib/payments/config";
import { createStripePortal, createStripeSubscriptionCheckout, stripeClient } from "@/lib/payments/stripe";
import { publicEnv } from "@/lib/env";
import type { ActionResult } from "./types";

function fail(e: unknown, fallback: string): ActionResult<never> {
  if (e instanceof AuthorizationError) return { ok: false, error: e.message };
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Invalid input" };
  console.error("[account]", e instanceof Error ? e.message : e);
  return { ok: false, error: fallback };
}

export async function updateProfile(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const user = await assertUser();
    const name = z.string().trim().min(1, "Enter a name").max(80).parse(fd.get("displayName"));
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("profiles").update({ display_name: name }).eq("id", user.id);
    if (error) return { ok: false, error: "Could not save your profile." };
    revalidatePath("/", "layout");
    return { ok: true, message: "Profile saved." };
  } catch (e) {
    return fail(e, "Could not save your profile.");
  }
}

export async function changePassword(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const user = await assertUser();
    const current = z.string().min(1, "Enter your current password").parse(fd.get("currentPassword"));
    const next = passwordSchema.parse(fd.get("newPassword"));
    if (next !== fd.get("confirmPassword")) return { ok: false, error: "New passwords do not match." };
    const supabase = await createSupabaseServerClient();
    // Re-authenticate before a sensitive change.
    const { error: authErr } = await supabase.auth.signInWithPassword({ email: user.email ?? "", password: current });
    if (authErr) return { ok: false, error: "Your current password is incorrect." };
    const { error } = await supabase.auth.updateUser({ password: next });
    if (error) return { ok: false, error: error.code === "same_password" ? "Choose a different password." : "Could not change your password." };
    return { ok: true, message: "Password changed." };
  } catch (e) {
    return fail(e, "Could not change your password.");
  }
}

export async function updatePreferences(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const user = await assertUser();
    const supabase = await createSupabaseServerClient();
    const prefs = {
      user_id: user.id,
      content_updates: fd.get("contentUpdates") === "on",
      product_announcements: fd.get("productAnnouncements") === "on",
      search_history_enabled: fd.get("searchHistory") === "on",
    };
    const { error } = await supabase.from("notification_preferences").upsert(prefs, { onConflict: "user_id" });
    if (error) return { ok: false, error: "Could not save preferences." };
    if (!prefs.search_history_enabled) await supabase.from("search_history").delete().eq("user_id", user.id);
    return { ok: true, message: prefs.search_history_enabled ? "Preferences saved." : "Preferences saved. Your search history has been cleared." };
  } catch (e) {
    return fail(e, "Could not save preferences.");
  }
}

export async function requestAccountDeletion(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const user = await assertUser();
    if (fd.get("confirm") !== "DELETE") return { ok: false, error: "Type DELETE to confirm." };
    const reason = z.string().trim().max(2000).optional().parse(fd.get("reason") || undefined);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("account_deletion_requests").insert({ user_id: user.id, reason: reason ?? null });
    if (error) {
      if (error.code === "23505") return { ok: true, message: "Your deletion request is already pending." };
      return { ok: false, error: "Could not submit your request." };
    }
    revalidatePath("/account");
    return { ok: true, message: "Request received. We will delete your account and personal data, keeping only order records that the law requires us to retain, and email you when it is done." };
  } catch (e) {
    return fail(e, "Could not submit your request.");
  }
}

export async function startSubscription(planId: string): Promise<ActionResult> {
  let url: string;
  try {
    const user = await assertUser();
    if (!isSubscriptionAvailable()) return { ok: false, error: "Subscriptions are not available yet." };
    const supabase = await createSupabaseServerClient();
    const { data: plan } = await supabase.from("plans").select("id, provider_price_id, active").eq("id", z.uuid().parse(planId)).maybeSingle();
    if (!plan?.active || !plan.provider_price_id) return { ok: false, error: "This plan is not available." };
    url = await createStripeSubscriptionCheckout({ priceId: plan.provider_price_id as string, planId: plan.id as string, userId: user.id, email: user.email, siteUrl: publicEnv.siteUrl });
  } catch (e) {
    return fail(e, "Could not start the subscription.");
  }
  redirect(url);
}

export async function openBillingPortal(): Promise<ActionResult> {
  let url: string;
  try {
    const user = await assertUser();
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("subscriptions")
      .select("provider, provider_customer_id")
      .eq("user_id", user.id)
      .eq("provider", "stripe")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data?.provider_customer_id) return { ok: false, error: "No billing account found." };
    url = await createStripePortal(data.provider_customer_id as string, `${publicEnv.siteUrl}/subscription`);
  } catch (e) {
    return fail(e, "Could not open billing settings.");
  }
  redirect(url);
}

/** Cancel at the end of the paid period. The webhook updates our record. */
export async function cancelSubscription(): Promise<ActionResult> {
  try {
    const user = await assertUser();
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("subscriptions")
      .select("provider, provider_subscription_id, status")
      .eq("user_id", user.id)
      .in("status", ["active", "trialing", "past_due"])
      .limit(1)
      .maybeSingle();
    if (!data) return { ok: false, error: "No active subscription." };
    if (data.provider !== "stripe") return { ok: false, error: "Please contact support to cancel." };
    await stripeClient().subscriptions.update(data.provider_subscription_id as string, { cancel_at_period_end: true });
    return { ok: true, message: "Cancellation requested. You keep access until the end of the current period; this page updates once Stripe confirms." };
  } catch (e) {
    return fail(e, "Could not cancel the subscription.");
  }
}
