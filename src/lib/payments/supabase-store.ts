import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env";
import { sendEmail } from "@/lib/email/send";
import { paymentFailedEmail, receiptEmail, refundEmail, subscriptionEmail } from "@/lib/email/templates";
import type { Notifier, OrderLookup, PaymentStore } from "./process";

/** PaymentStore backed by Supabase (service role, trusted server code only). */
export function supabasePaymentStore(): PaymentStore {
  const db = createSupabaseAdminClient();
  return {
    async recordEvent(e) {
      const { error } = await db.from("payment_events").insert({
        provider: e.provider,
        event_id: e.eventId,
        event_type: e.eventType,
        payload: e.payload as object,
      });
      if (!error) return "new";
      if (error.code !== "23505") throw new Error(`Could not record payment event: ${error.message}`);
      const { data } = await db.from("payment_events").select("status").eq("provider", e.provider).eq("event_id", e.eventId).single();
      return (data?.status as "received" | "processed" | "ignored" | "failed") ?? "received";
    },
    async markEvent(provider, eventId, status, error) {
      await db
        .from("payment_events")
        .update({ status, error: error ?? null, processed_at: new Date().toISOString() })
        .eq("provider", provider)
        .eq("event_id", eventId);
    },
    async findOrderId({ orderId, provider, providerReference, paymentId }) {
      if (orderId && /^[0-9a-f-]{36}$/i.test(orderId)) {
        const { data } = await db.from("orders").select("id").eq("id", orderId).maybeSingle();
        if (data) return data.id as string;
      }
      if (providerReference) {
        const { data } = await db.from("orders").select("id").eq("provider", provider).eq("provider_reference", providerReference).maybeSingle();
        if (data) return data.id as string;
      }
      if (paymentId) {
        const { data } = await db.from("orders").select("id").eq("provider", provider).eq("provider_payment_id", paymentId).maybeSingle();
        if (data) return data.id as string;
      }
      return null;
    },
    async getOrder(orderId): Promise<OrderLookup | null> {
      const { data } = await db
        .from("orders")
        .select("id, user_id, amount_minor_units, currency, order_items(product_title_snapshot)")
        .eq("id", orderId)
        .maybeSingle();
      if (!data) return null;
      return {
        id: data.id as string,
        user_id: data.user_id as string | null,
        amount_minor_units: data.amount_minor_units as number,
        currency: data.currency as string,
        items: ((data.order_items ?? []) as { product_title_snapshot: string }[]).map((i) => i.product_title_snapshot),
      };
    },
    async fulfill(a) {
      const { data, error } = await db.rpc("service_fulfill_order", {
        p_order: a.orderId,
        p_provider: a.provider,
        p_provider_reference: a.providerReference,
        p_provider_payment_id: a.paymentId,
        p_amount_minor_units: a.amount,
        p_currency: a.currency,
      });
      if (error) throw new Error(error.message);
      return data as string;
    },
    async markUnpaid(orderId, status, reason) {
      const { data, error } = await db.rpc("service_mark_order_unpaid", { p_order: orderId, p_status: status, p_reason: reason });
      if (error) throw new Error(error.message);
      return data as string;
    },
    async applyRefund(a) {
      const { data, error } = await db.rpc("service_apply_refund", {
        p_order: a.orderId,
        p_amount_minor_units: a.amount,
        p_currency: a.currency,
        p_provider_refund_id: a.refundId,
        p_reason: "Provider refund",
        p_actor: null,
      });
      if (error) throw new Error(error.message);
      return data as string;
    },
    async upsertSubscription(s) {
      let userId = s.userId;
      const planId = s.planId;
      if (!userId) {
        const { data } = await db.from("subscriptions").select("user_id").eq("provider", s.provider).eq("provider_subscription_id", s.subscriptionId).maybeSingle();
        userId = (data?.user_id as string | undefined) ?? null;
      }
      if (!userId) return null;
      const { error } = await db.rpc("service_upsert_subscription", {
        p_user: userId,
        p_provider: s.provider,
        p_provider_subscription_id: s.subscriptionId,
        p_provider_customer_id: s.customerId,
        p_plan: planId,
        p_status: s.status,
        p_current_period_end: s.currentPeriodEnd,
        p_cancel_at_period_end: s.cancelAtPeriodEnd,
      });
      if (error) throw new Error(error.message);
      return { userId };
    },
  };
}

async function emailFor(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const { data } = await createSupabaseAdminClient().auth.admin.getUserById(userId);
  return data.user?.email ?? null;
}

async function wantsContentUpdates(userId: string): Promise<boolean> {
  const { data } = await createSupabaseAdminClient().from("notification_preferences").select("content_updates").eq("user_id", userId).maybeSingle();
  return data?.content_updates ?? true;
}
export { wantsContentUpdates };

export function emailNotifier(): Notifier {
  const site = publicEnv.siteUrl;
  return {
    async receipt(order) {
      const to = await emailFor(order.user_id);
      if (!to) return;
      const e = receiptEmail({ orderId: order.id, items: order.items, amount: order.amount_minor_units, currency: order.currency, siteUrl: site, paidAt: new Date().toISOString() });
      await sendEmail({ to, ...e, template: "receipt", userId: order.user_id });
    },
    async paymentFailed(order, reason) {
      const to = await emailFor(order.user_id);
      if (!to) return;
      await sendEmail({ to, ...paymentFailedEmail({ orderId: order.id, reason, siteUrl: site }), template: "payment_failed", userId: order.user_id });
    },
    async refund(order, amount, currency, full) {
      const to = await emailFor(order.user_id);
      if (!to) return;
      await sendEmail({ to, ...refundEmail({ orderId: order.id, amount, currency, full, siteUrl: site }), template: "refund", userId: order.user_id });
    },
    async subscription(userId, status, periodEnd) {
      const to = await emailFor(userId);
      if (!to) return;
      await sendEmail({ to, ...subscriptionEmail({ status, periodEnd, siteUrl: site }), template: `subscription_${status}`, userId });
    },
    async subscriptionPaymentFailed(email) {
      if (!email) return;
      await sendEmail({ to: email, ...subscriptionEmail({ status: "past_due", periodEnd: null, siteUrl: site }), template: "subscription_payment_failed" });
    },
  };
}
