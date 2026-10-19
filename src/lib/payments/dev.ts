import "server-only";
import { getServerEnv } from "@/lib/env";
import { hmacSha256Hex, safeEqualHex } from "./hmac";
import type { CheckoutContext, CheckoutStart, PaymentEvent } from "./types";
import { WebhookVerificationError } from "./types";

/**
 * DEVELOPMENT-ONLY payment provider. It never moves money. Checkout opens a
 * clearly labelled simulation page that sends a signed webhook through the
 * same verification and fulfilment path as real providers. It refuses to run
 * when APP_ENV=production.
 */

function secret(): string {
  const env = getServerEnv();
  if (env.APP_ENV === "production") throw new Error("The development payment provider is disabled in production.");
  if (!env.DEV_PAYMENTS_SECRET) throw new Error("DEV_PAYMENTS_SECRET is not configured");
  return env.DEV_PAYMENTS_SECRET;
}

export async function createDevCheckout(ctx: CheckoutContext): Promise<CheckoutStart> {
  secret();
  return { kind: "redirect", url: `${ctx.siteUrl}/dev/checkout/${ctx.order.id}`, providerReference: `dev_${ctx.order.id}` };
}

export type DevWebhookBody =
  | { id: string; type: "payment.succeeded"; order_id: string; amount: number; currency: string }
  | { id: string; type: "payment.failed"; order_id: string; reason: string }
  | { id: string; type: "refund.succeeded"; order_id: string; refund_id: string; amount: number; currency: string };

export function signDevWebhook(body: DevWebhookBody): { raw: string; signature: string } {
  const raw = JSON.stringify(body);
  return { raw, signature: hmacSha256Hex(secret(), raw) };
}

export function parseDevWebhook(rawBody: string, signature: string | null): PaymentEvent {
  if (!signature || !safeEqualHex(hmacSha256Hex(secret(), rawBody), signature)) throw new WebhookVerificationError();
  const b = JSON.parse(rawBody) as DevWebhookBody;
  const base = { provider: "dev" as const, eventId: b.id, eventType: b.type, raw: b };
  switch (b.type) {
    case "payment.succeeded":
      return { kind: "payment_succeeded", ...base, orderId: b.order_id, providerReference: `dev_${b.order_id}`, paymentId: `devpay_${b.order_id}`, amount: b.amount, currency: b.currency };
    case "payment.failed":
      return { kind: "payment_failed", ...base, orderId: b.order_id, providerReference: `dev_${b.order_id}`, reason: b.reason };
    case "refund.succeeded":
      return { kind: "refund_succeeded", ...base, orderId: b.order_id, paymentId: `devpay_${b.order_id}`, refundId: b.refund_id, amount: b.amount, currency: b.currency };
    default:
      return { kind: "ignored", ...base };
  }
}
