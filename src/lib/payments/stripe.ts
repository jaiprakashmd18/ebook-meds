import "server-only";
import Stripe from "stripe";
import { getServerEnv } from "@/lib/env";
import type { CheckoutContext, CheckoutStart, PaymentEvent } from "./types";
import { WebhookVerificationError } from "./types";

let client: Stripe | null = null;

export function stripeClient(): Stripe {
  const key = getServerEnv().STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  client ??= new Stripe(key, { appInfo: { name: "StudySimplify" } });
  return client;
}

export async function createStripeCheckout(ctx: CheckoutContext): Promise<CheckoutStart> {
  const session = await stripeClient().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: ctx.order.currency.toLowerCase(),
          unit_amount: ctx.order.amount_minor_units,
          product_data: { name: ctx.product.title, metadata: { content_item_id: ctx.product.id } },
        },
      },
    ],
    client_reference_id: ctx.order.id,
    metadata: { order_id: ctx.order.id, user_id: ctx.customer.id },
    payment_intent_data: { metadata: { order_id: ctx.order.id } },
    ...(ctx.customer.email ? { customer_email: ctx.customer.email } : {}),
    success_url: `${ctx.siteUrl}/orders/${ctx.order.id}?checkout=success`,
    cancel_url: `${ctx.siteUrl}/checkout/${ctx.product.slug}?cancelled=1`,
    // Unpaid sessions expire after one hour; the expiry webhook cancels the order.
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return { kind: "redirect", url: session.url, providerReference: session.id };
}

export async function createStripeRefund(paymentIntentId: string, amount: number) {
  const refund = await stripeClient().refunds.create({ payment_intent: paymentIntentId, amount });
  return { refundId: refund.id, status: refund.status };
}

export async function createStripeSubscriptionCheckout(opts: {
  priceId: string;
  planId: string;
  userId: string;
  email: string | null;
  siteUrl: string;
}): Promise<string> {
  const session = await stripeClient().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: opts.priceId, quantity: 1 }],
    client_reference_id: opts.userId,
    subscription_data: { metadata: { user_id: opts.userId, plan_id: opts.planId } },
    ...(opts.email ? { customer_email: opts.email } : {}),
    success_url: `${opts.siteUrl}/subscription?checkout=success`,
    cancel_url: `${opts.siteUrl}/subscription?checkout=cancelled`,
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return session.url;
}

export async function createStripePortal(customerId: string, returnUrl: string): Promise<string> {
  const portal = await stripeClient().billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
  return portal.url;
}

type SubscriptionStatus = Extract<PaymentEvent, { kind: "subscription_changed" }>["status"];

const STATUS_MAP: Record<string, SubscriptionStatus> = {
  incomplete: "incomplete",
  incomplete_expired: "expired",
  trialing: "trialing",
  active: "active",
  past_due: "past_due",
  canceled: "canceled",
  unpaid: "unpaid",
  paused: "unpaid",
};

type Obj = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : v && typeof v === "object" && "id" in v ? String((v as Obj).id) : null);

/** Verify the Stripe signature and normalise the event. Throws on a bad signature. */
export function parseStripeWebhook(rawBody: string, signature: string | null, secret = getServerEnv().STRIPE_WEBHOOK_SECRET): PaymentEvent {
  if (!signature || !secret) throw new WebhookVerificationError("Missing Stripe signature or secret");
  let event: Stripe.Event;
  try {
    // A Stripe instance is not needed just to verify signatures.
    event = Stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    throw new WebhookVerificationError();
  }
  const base = { provider: "stripe" as const, eventId: event.id, eventType: event.type, raw: event };
  const o = event.data.object as unknown as Obj;
  const meta = (o.metadata ?? {}) as Record<string, string>;

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      if (o.mode !== "payment" || o.payment_status !== "paid") return { kind: "ignored", ...base };
      return {
        kind: "payment_succeeded",
        ...base,
        orderId: meta.order_id ?? (o.client_reference_id as string | null) ?? null,
        providerReference: o.id as string,
        paymentId: str(o.payment_intent),
        amount: Number(o.amount_total),
        currency: String(o.currency).toUpperCase(),
      };
    }
    case "checkout.session.async_payment_failed":
      return { kind: "payment_failed", ...base, orderId: meta.order_id ?? null, providerReference: o.id as string, reason: "Payment failed" };
    case "checkout.session.expired":
      if (o.mode !== "payment") return { kind: "ignored", ...base };
      return { kind: "checkout_expired", ...base, orderId: meta.order_id ?? null, providerReference: o.id as string, reason: "Checkout expired" };
    case "refund.created":
    case "refund.updated": {
      if (o.status !== "succeeded") return { kind: "ignored", ...base };
      return {
        kind: "refund_succeeded",
        ...base,
        orderId: (meta.order_id as string | undefined) ?? null,
        paymentId: str(o.payment_intent),
        refundId: o.id as string,
        amount: Number(o.amount),
        currency: String(o.currency).toUpperCase(),
      };
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const items = ((o.items as Obj | undefined)?.data ?? []) as Obj[];
      const periodEnd = Number(items[0]?.current_period_end ?? o.current_period_end ?? 0);
      return {
        kind: "subscription_changed",
        ...base,
        userId: meta.user_id ?? null,
        planId: meta.plan_id ?? null,
        subscriptionId: o.id as string,
        customerId: str(o.customer),
        status: STATUS_MAP[String(o.status)] ?? "incomplete",
        currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        cancelAtPeriodEnd: Boolean(o.cancel_at_period_end),
      };
    }
    case "invoice.payment_failed": {
      const parent = (o.parent as Obj | undefined)?.subscription_details as Obj | undefined;
      return {
        kind: "subscription_payment_failed",
        ...base,
        subscriptionId: str(parent?.subscription ?? o.subscription),
        customerEmail: (o.customer_email as string | null) ?? null,
      };
    }
    default:
      return { kind: "ignored", ...base };
  }
}
