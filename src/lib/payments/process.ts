import type { PaymentEvent } from "./types";

/**
 * Process a VERIFIED payment event. Steps:
 *   1. Record the event (unique per provider + event id). A duplicate
 *      delivery of an already-processed event is acknowledged and skipped.
 *   2. Apply it through the transactional database functions, which are
 *      themselves idempotent (row locks + status checks).
 *   3. Send the matching email only when this call changed state.
 *   4. Mark the event processed / failed for the admin log.
 *
 * Dependencies are injected so this logic can be unit tested without a
 * database or payment provider.
 */

export type OrderLookup = { id: string; user_id: string | null; amount_minor_units: number; currency: string; items: string[] };

export interface PaymentStore {
  /** Returns "new" when the event row was inserted, or the stored status for a repeat delivery. */
  recordEvent(e: { provider: string; eventId: string; eventType: string; payload: unknown }): Promise<"new" | "received" | "processed" | "ignored" | "failed">;
  markEvent(provider: string, eventId: string, status: "processed" | "ignored" | "failed", error?: string): Promise<void>;
  findOrderId(e: { orderId: string | null; provider: string; providerReference?: string | null; paymentId?: string | null }): Promise<string | null>;
  getOrder(orderId: string): Promise<OrderLookup | null>;
  fulfill(a: { orderId: string; provider: string; providerReference: string | null; paymentId: string | null; amount: number; currency: string }): Promise<string>;
  markUnpaid(orderId: string, status: "failed" | "cancelled", reason: string): Promise<string>;
  applyRefund(a: { orderId: string; amount: number; currency: string; refundId: string }): Promise<string>;
  upsertSubscription(a: Extract<PaymentEvent, { kind: "subscription_changed" }>): Promise<{ userId: string } | null>;
}

export interface Notifier {
  receipt(order: OrderLookup): Promise<void>;
  paymentFailed(order: OrderLookup, reason: string): Promise<void>;
  refund(order: OrderLookup, amount: number, currency: string, full: boolean): Promise<void>;
  subscription(userId: string, status: string, periodEnd: string | null): Promise<void>;
  subscriptionPaymentFailed(email: string | null, subscriptionId: string | null): Promise<void>;
}

export type ProcessResult = { status: "processed" | "duplicate" | "ignored" | "failed"; detail?: string };

export async function processPaymentEvent(event: PaymentEvent, store: PaymentStore, notify: Notifier): Promise<ProcessResult> {
  const recorded = await store.recordEvent({ provider: event.provider, eventId: event.eventId, eventType: event.eventType, payload: event.raw });
  if (recorded === "processed" || recorded === "ignored") return { status: "duplicate" };
  // "received" or "failed" from an earlier attempt are retried: every step
  // below is idempotent, so reprocessing cannot double-grant or double-refund.

  try {
    switch (event.kind) {
      case "ignored": {
        await store.markEvent(event.provider, event.eventId, "ignored");
        return { status: "ignored" };
      }
      case "payment_succeeded": {
        const orderId = await store.findOrderId(event);
        if (!orderId) return fail(store, event, "No matching order");
        const outcome = await store.fulfill({
          orderId,
          provider: event.provider,
          providerReference: event.providerReference,
          paymentId: event.paymentId,
          amount: event.amount,
          currency: event.currency,
        });
        if (outcome === "fulfilled") {
          const order = await store.getOrder(orderId);
          if (order) await safe(() => notify.receipt(order));
        } else if (outcome !== "already_paid") {
          return fail(store, event, `Fulfilment refused: ${outcome}`);
        }
        await store.markEvent(event.provider, event.eventId, "processed");
        return { status: "processed", detail: outcome };
      }
      case "payment_failed":
      case "checkout_expired": {
        const orderId = await store.findOrderId(event);
        if (!orderId) return fail(store, event, "No matching order");
        const outcome = await store.markUnpaid(orderId, event.kind === "payment_failed" ? "failed" : "cancelled", event.reason);
        if (outcome === "updated" && event.kind === "payment_failed") {
          const order = await store.getOrder(orderId);
          if (order) await safe(() => notify.paymentFailed(order, event.reason));
        }
        await store.markEvent(event.provider, event.eventId, "processed");
        return { status: "processed", detail: outcome };
      }
      case "refund_succeeded": {
        const orderId = await store.findOrderId(event);
        if (!orderId) return fail(store, event, "No matching order for refund");
        const outcome = await store.applyRefund({ orderId, amount: event.amount, currency: event.currency, refundId: event.refundId });
        if (outcome === "refunded" || outcome === "partially_refunded") {
          const order = await store.getOrder(orderId);
          if (order) await safe(() => notify.refund(order, event.amount, event.currency, outcome === "refunded"));
        } else if (outcome !== "already_recorded") {
          return fail(store, event, `Refund not applied: ${outcome}`);
        }
        await store.markEvent(event.provider, event.eventId, "processed");
        return { status: "processed", detail: outcome };
      }
      case "subscription_changed": {
        const saved = await store.upsertSubscription(event);
        if (!saved) return fail(store, event, "Subscription has no user or plan metadata");
        await safe(() => notify.subscription(saved.userId, event.status, event.currentPeriodEnd));
        await store.markEvent(event.provider, event.eventId, "processed");
        return { status: "processed" };
      }
      case "subscription_payment_failed": {
        await safe(() => notify.subscriptionPaymentFailed(event.customerEmail, event.subscriptionId));
        await store.markEvent(event.provider, event.eventId, "processed");
        return { status: "processed" };
      }
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await store.markEvent(event.provider, event.eventId, "failed", message).catch(() => {});
    // Re-throw so the webhook responds 500 and the provider retries.
    throw e;
  }
}

async function fail(store: PaymentStore, event: PaymentEvent, reason: string): Promise<ProcessResult> {
  await store.markEvent(event.provider, event.eventId, "failed", reason);
  return { status: "failed", detail: reason };
}

/** Email problems must never undo or block a recorded payment. */
async function safe(fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e) {
    console.error("[payments] notification failed", e instanceof Error ? e.message : e);
  }
}
