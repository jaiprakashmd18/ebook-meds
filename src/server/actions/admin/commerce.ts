"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { assertPermission, AuthorizationError } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { couponSchema } from "@/lib/validation/admin";
import { minorToMajorString, parseMajorToMinor } from "@/lib/money";
import { createStripeRefund } from "@/lib/payments/stripe";
import { createRazorpayRefund } from "@/lib/payments/razorpay";
import { emailNotifier, supabasePaymentStore } from "@/lib/payments/supabase-store";
import { sendEmail } from "@/lib/email/send";
import { contentUpdateEmail } from "@/lib/email/templates";
import { publicEnv } from "@/lib/env";
import type { ActionResult } from "../types";

function fail(e: unknown, fallback: string): ActionResult<never> {
  if (e instanceof AuthorizationError) return { ok: false, error: e.message };
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Invalid input" };
  console.error("[admin commerce]", e instanceof Error ? e.message : e);
  return { ok: false, error: fallback };
}

async function audit(action: string, type: string, id: string, metadata: Record<string, unknown> = {}) {
  const supabase = await createSupabaseServerClient();
  await supabase.rpc("log_audit_event", { p_action: action, p_resource_type: type, p_resource_id: id, p_metadata: metadata });
}

/**
 * Refund an order. For real providers the refund is requested from the
 * provider and recorded when its signed webhook confirms it, so our records
 * never claim a refund that did not happen.
 */
export async function refundOrder(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const user = await assertPermission("orders.manage");
    const orderId = z.uuid().parse(fd.get("orderId"));
    const admin = createSupabaseAdminClient();
    const { data: order } = await admin
      .from("orders")
      .select("id, amount_minor_units, refunded_minor_units, currency, payment_status, provider, provider_payment_id")
      .eq("id", orderId)
      .single();
    if (!order) return { ok: false, error: "Order not found." };
    if (!["paid", "partially_refunded"].includes(order.payment_status as string)) return { ok: false, error: "Only paid orders can be refunded." };
    const remaining = (order.amount_minor_units as number) - (order.refunded_minor_units as number);
    const rawAmount = String(fd.get("amount") ?? "").trim();
    const amount = rawAmount ? parseMajorToMinor(rawAmount, order.currency as string) : remaining;
    if (!amount || amount <= 0 || amount > remaining) return { ok: false, error: `Enter an amount up to the remaining ${minorToMajorString(remaining, order.currency as string)} ${order.currency}.` };
    const reason = z.string().trim().max(500).parse(fd.get("reason") ?? "");

    switch (order.provider) {
      case "stripe": {
        if (!order.provider_payment_id) return { ok: false, error: "No Stripe payment reference recorded." };
        const r = await createStripeRefund(order.provider_payment_id as string, amount);
        await audit("order.refund_requested", "order", orderId, { amount, provider: "stripe", refund: r.refundId, by: user.id, reason });
        return { ok: true, message: `Refund requested from Stripe (${r.status}). It will be recorded and access updated when Stripe confirms.` };
      }
      case "razorpay": {
        if (!order.provider_payment_id) return { ok: false, error: "No Razorpay payment reference recorded." };
        const r = await createRazorpayRefund(order.provider_payment_id as string, amount);
        await audit("order.refund_requested", "order", orderId, { amount, provider: "razorpay", refund: r.refundId, by: user.id, reason });
        return { ok: true, message: `Refund requested from Razorpay (${r.status}). It will be recorded when Razorpay confirms.` };
      }
      case "dev":
      case "coupon": {
        // No external money moved; record directly.
        const { data, error } = await admin.rpc("service_apply_refund", {
          p_order: orderId,
          p_amount_minor_units: amount,
          p_currency: order.currency,
          p_provider_refund_id: `manual_${crypto.randomUUID()}`,
          p_reason: reason || "Manual refund",
          p_actor: user.id,
        });
        if (error) return { ok: false, error: "Could not record the refund." };
        const lookup = await supabasePaymentStore().getOrder(orderId);
        if (lookup) await emailNotifier().refund(lookup, amount, order.currency as string, data === "refunded").catch(() => {});
        revalidatePath("/admin/orders");
        return { ok: true, message: `Refund recorded (${data}).` };
      }
      default:
        return { ok: false, error: "This order has no payment provider recorded." };
    }
  } catch (e) {
    return fail(e, "The refund failed. Nothing was changed.");
  }
}

export async function saveCoupon(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await assertPermission("coupons.manage");
    const c = couponSchema.parse(Object.fromEntries(fd));
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("coupons").insert(c);
    if (error) return { ok: false, error: error.code === "23505" ? "That code already exists." : "Could not create the coupon." };
    await audit("coupon.created", "coupon", c.code);
    revalidatePath("/admin/coupons");
    return { ok: true, message: `Coupon ${c.code} created.` };
  } catch (e) {
    return fail(e, "Could not create the coupon.");
  }
}

export async function setCouponActive(id: string, active: boolean): Promise<ActionResult> {
  try {
    await assertPermission("coupons.manage");
    const supabase = await createSupabaseServerClient();
    await supabase.from("coupons").update({ active }).eq("id", z.uuid().parse(id));
    await audit(active ? "coupon.activated" : "coupon.deactivated", "coupon", id);
    revalidatePath("/admin/coupons");
    return { ok: true, message: active ? "Coupon activated." : "Coupon deactivated." };
  } catch (e) {
    return fail(e, "Could not update the coupon.");
  }
}

const ROLES = ["super_admin", "content_editor", "reviewer"] as const;

export async function setUserRole(userId: string, role: (typeof ROLES)[number], grant: boolean): Promise<ActionResult> {
  try {
    const actor = await assertPermission("customers.manage");
    const uid = z.uuid().parse(userId);
    const r = z.enum(ROLES).parse(role);
    if (!grant && uid === actor.id && r === "super_admin") return { ok: false, error: "You cannot remove your own super administrator role." };
    const supabase = await createSupabaseServerClient();
    const { error } = grant
      ? await supabase.from("user_roles").insert({ user_id: uid, role: r, granted_by: actor.id })
      : await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", r);
    if (error && error.code !== "23505") return { ok: false, error: "Could not change the role." };
    await audit(grant ? "role.granted" : "role.revoked", "user", uid, { role: r });
    revalidatePath("/admin/customers");
    return { ok: true, message: grant ? "Role granted." : "Role removed." };
  } catch (e) {
    return fail(e, "Could not change the role.");
  }
}

export async function grantAccess(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const actor = await assertPermission("customers.manage");
    const userId = z.uuid().parse(fd.get("userId"));
    const itemId = z.uuid("Choose a title").parse(fd.get("itemId"));
    const reason = z.string().trim().min(3, "Give a reason (at least 3 characters)").max(500).parse(fd.get("reason"));
    const expires = String(fd.get("expiresAt") ?? "");
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("access_grants").insert({
      user_id: userId,
      content_item_id: itemId,
      granted_by: actor.id,
      reason,
      expires_at: expires ? new Date(expires).toISOString() : null,
    });
    if (error) return { ok: false, error: "Could not grant access." };
    await audit("access.granted", "user", userId, { item: itemId, reason });
    revalidatePath("/admin/customers");
    return { ok: true, message: "Access granted." };
  } catch (e) {
    return fail(e, "Could not grant access.");
  }
}

export async function revokeGrant(id: string): Promise<ActionResult> {
  try {
    await assertPermission("customers.manage");
    const supabase = await createSupabaseServerClient();
    await supabase.from("access_grants").update({ revoked_at: new Date().toISOString() }).eq("id", z.uuid().parse(id));
    await audit("access.revoked", "access_grant", id);
    revalidatePath("/admin/customers");
    return { ok: true, message: "Access revoked." };
  } catch (e) {
    return fail(e, "Could not revoke access.");
  }
}

/** Permanently delete a user who requested it. Orders are retained without the profile. */
export async function processDeletionRequest(requestId: string): Promise<ActionResult> {
  try {
    const actor = await assertPermission("settings.manage");
    const admin = createSupabaseAdminClient();
    const { data: req } = await admin.from("account_deletion_requests").select("id, user_id, status").eq("id", z.uuid().parse(requestId)).single();
    if (!req || req.status !== "pending" || !req.user_id) return { ok: false, error: "Request is not pending." };
    if (req.user_id === actor.id) return { ok: false, error: "Use another super administrator account to delete your own account." };
    const { data: u } = await admin.auth.admin.getUserById(req.user_id as string);
    const email = u.user?.email ?? null;
    await admin.from("account_deletion_requests").update({ status: "completed", processed_at: new Date().toISOString(), processed_by: actor.id }).eq("id", req.id);
    const { error } = await admin.auth.admin.deleteUser(req.user_id as string);
    if (error) {
      await admin.from("account_deletion_requests").update({ status: "pending", processed_at: null, processed_by: null }).eq("id", req.id);
      return { ok: false, error: "Deleting the account failed. Nothing was removed." };
    }
    await audit("account.deleted", "account_deletion_request", req.id as string);
    let emailNote = "";
    if (email) {
      const r = await sendEmail({
        to: email,
        subject: "Your StudySimplify account has been deleted",
        html: "<p>Your StudySimplify account and personal learning data have been deleted as you requested.</p>",
        text: "Your StudySimplify account and personal learning data have been deleted as you requested.",
        template: "account_deleted",
      });
      emailNote = r.status === "sent" ? " Confirmation email sent." : " Confirmation email was NOT sent (no email provider configured).";
    }
    revalidatePath("/admin/settings");
    return { ok: true, message: `Account deleted.${emailNote}` };
  } catch (e) {
    return fail(e, "Could not process the request.");
  }
}

const planSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500),
  price: z.string().trim(),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  billingInterval: z.enum(["month", "year"]),
  scope: z.enum(["subscription_eligible", "all_premium"]),
  providerPriceId: z.string().trim().max(100).optional(),
  active: z.boolean(),
});

export async function savePlan(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await assertPermission("settings.manage");
    const p = planSchema.parse({ ...Object.fromEntries(fd), active: fd.get("active") === "on" });
    const price = parseMajorToMinor(p.price, p.currency);
    if (!price) return { ok: false, error: "Enter a price above 0." };
    if (p.active && !p.providerPriceId) return { ok: false, error: "An active plan needs the provider's price ID (e.g. Stripe price_…)." };
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("plans")
      .update({
        name: p.name,
        description: p.description,
        price_minor_units: price,
        currency: p.currency,
        billing_interval: p.billingInterval,
        entitlements: { scope: p.scope, practice_questions: true },
        provider_price_id: p.providerPriceId || null,
        active: p.active,
      })
      .eq("id", p.id);
    if (error) return { ok: false, error: "Could not save the plan." };
    await audit("plan.updated", "plan", p.id, { active: p.active });
    revalidatePath("/admin/settings");
    return { ok: true, message: "Plan saved. The displayed price must match the price configured in your payment provider." };
  } catch (e) {
    return fail(e, "Could not save the plan.");
  }
}

/** Email owners of a title about an important update (respects their preference). */
export async function notifyContentUpdate(itemId: string): Promise<ActionResult> {
  try {
    await assertPermission("content.publish");
    const id = z.uuid().parse(itemId);
    const admin = createSupabaseAdminClient();
    const { data: item } = await admin.from("content_items").select("id, title, slug, publication_status, current_version_id, current_version_number").eq("id", id).single();
    if (!item || item.publication_status !== "published") return { ok: false, error: "Only published titles can trigger update emails." };
    const { data: version } = await admin.from("content_versions").select("change_summary").eq("id", item.current_version_id).single();
    const { data: bundles } = await admin.from("bundle_items").select("bundle_id").eq("content_item_id", id);
    const productIds = [id, ...(bundles ?? []).map((b) => b.bundle_id as string)];
    const { data: purchases } = await admin.from("purchases").select("user_id").in("product_id", productIds).eq("access_status", "active");
    const userIds = [...new Set((purchases ?? []).map((p) => p.user_id as string))];
    const { data: prefs } = await admin.from("notification_preferences").select("user_id, content_updates").in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
    const optedOut = new Set((prefs ?? []).filter((p) => !p.content_updates).map((p) => p.user_id as string));
    let sent = 0;
    let notSent = 0;
    for (const uid of userIds.filter((u) => !optedOut.has(u))) {
      const { data: u } = await admin.auth.admin.getUserById(uid);
      if (!u.user?.email) continue;
      const email = contentUpdateEmail({ title: item.title as string, version: item.current_version_number as number, summary: (version?.change_summary as string | null) ?? null, slug: item.slug as string, siteUrl: publicEnv.siteUrl });
      const r = await sendEmail({ to: u.user.email, ...email, template: "content_update", userId: uid });
      if (r.status === "sent") sent++;
      else notSent++;
    }
    await audit("content.update_notified", "content_item", id, { sent, notSent, optedOut: optedOut.size });
    return {
      ok: true,
      message: `${sent} email(s) sent${notSent ? `, ${notSent} not sent (check the email provider configuration)` : ""}. ${optedOut.size} owner(s) opted out.`,
    };
  } catch (e) {
    return fail(e, "Could not send update emails.");
  }
}
