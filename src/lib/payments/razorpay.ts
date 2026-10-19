import "server-only";
import { getServerEnv } from "@/lib/env";
import { hmacSha256Hex, safeEqualHex } from "./hmac";
import type { CheckoutContext, CheckoutStart, PaymentEvent } from "./types";
import { WebhookVerificationError } from "./types";

const API = "https://api.razorpay.com/v1";

function auth() {
  const env = getServerEnv();
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) throw new Error("Razorpay keys are not configured");
  return { keyId: env.RAZORPAY_KEY_ID, header: `Basic ${Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64")}` };
}

async function call<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { Authorization: auth().header, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Razorpay API ${path} failed with ${res.status}: ${detail.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export async function createRazorpayCheckout(ctx: CheckoutContext): Promise<CheckoutStart> {
  const order = await call<{ id: string; amount: number; currency: string }>("/orders", {
    amount: ctx.order.amount_minor_units,
    currency: ctx.order.currency,
    receipt: ctx.order.id.slice(0, 40),
    notes: { order_id: ctx.order.id, user_id: ctx.customer.id, content_item_id: ctx.product.id },
  });
  return {
    kind: "razorpay",
    providerReference: order.id,
    keyId: auth().keyId,
    razorpayOrderId: order.id,
    amount: order.amount,
    currency: order.currency,
    description: ctx.product.title,
    prefillEmail: ctx.customer.email,
  };
}

export async function createRazorpayRefund(paymentId: string, amount: number) {
  const refund = await call<{ id: string; status: string }>(`/payments/${encodeURIComponent(paymentId)}/refund`, { amount });
  return { refundId: refund.id, status: refund.status };
}

type Entity = Record<string, unknown>;

/**
 * Verify X-Razorpay-Signature (HMAC-SHA256 of the raw body with the webhook
 * secret) and normalise the event. Fulfilment uses `order.paid`.
 */
export function parseRazorpayWebhook(
  rawBody: string,
  signature: string | null,
  eventIdHeader: string | null,
  secret = getServerEnv().RAZORPAY_WEBHOOK_SECRET,
): PaymentEvent {
  if (!signature || !secret) throw new WebhookVerificationError("Missing Razorpay signature or secret");
  if (!safeEqualHex(hmacSha256Hex(secret, rawBody), signature)) throw new WebhookVerificationError();
  const body = JSON.parse(rawBody) as { event: string; payload: Record<string, { entity: Entity }>; created_at?: number };
  const payment = body.payload.payment?.entity;
  const order = body.payload.order?.entity;
  const refund = body.payload.refund?.entity;
  // Razorpay sends a unique id per event in this header; fall back to a
  // deterministic key so retries of the same event still deduplicate.
  const eventId = eventIdHeader || `${body.event}:${String(payment?.id ?? refund?.id ?? order?.id)}`;
  const base = { provider: "razorpay" as const, eventId, eventType: body.event, raw: body };
  const notes = (order?.notes ?? payment?.notes ?? {}) as Record<string, string>;

  switch (body.event) {
    case "order.paid":
      return {
        kind: "payment_succeeded",
        ...base,
        orderId: notes.order_id ?? null,
        providerReference: String(order?.id),
        paymentId: payment ? String(payment.id) : null,
        amount: Number(order?.amount_paid ?? payment?.amount),
        currency: String(order?.currency ?? payment?.currency).toUpperCase(),
      };
    case "payment.failed":
      return {
        kind: "payment_failed",
        ...base,
        orderId: notes.order_id ?? null,
        providerReference: payment?.order_id ? String(payment.order_id) : null,
        reason: String((payment?.error_description as string | undefined) ?? "Payment failed"),
      };
    case "refund.processed":
      return {
        kind: "refund_succeeded",
        ...base,
        orderId: ((refund?.notes ?? {}) as Record<string, string>).order_id ?? null,
        paymentId: refund?.payment_id ? String(refund.payment_id) : null,
        refundId: String(refund?.id),
        amount: Number(refund?.amount),
        currency: String(refund?.currency).toUpperCase(),
      };
    default:
      return { kind: "ignored", ...base };
  }
}
