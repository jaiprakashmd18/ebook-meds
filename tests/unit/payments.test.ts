import { beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { hmacSha256Hex } from "@/lib/payments/hmac";
import { parseStripeWebhook } from "@/lib/payments/stripe";
import { parseRazorpayWebhook } from "@/lib/payments/razorpay";
import { parseDevWebhook, signDevWebhook } from "@/lib/payments/dev";
import { processPaymentEvent, type Notifier, type PaymentStore } from "@/lib/payments/process";
import { WebhookVerificationError, type PaymentEvent } from "@/lib/payments/types";
import { resetServerEnvCache } from "@/lib/env";

const STRIPE_SECRET = "whsec_test_secret";

function stripeSigned(payload: object) {
  const raw = JSON.stringify(payload);
  const header = Stripe.webhooks.generateTestHeaderString({ payload: raw, secret: STRIPE_SECRET });
  return { raw, header };
}

describe("Stripe webhook verification", () => {
  const completed = {
    id: "evt_1",
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_123",
        object: "checkout.session",
        mode: "payment",
        payment_status: "paid",
        amount_total: 14900,
        currency: "inr",
        payment_intent: "pi_123",
        client_reference_id: "11111111-1111-4111-8111-111111111111",
        metadata: { order_id: "11111111-1111-4111-8111-111111111111" },
      },
    },
  };

  it("accepts a correctly signed event and normalises it", () => {
    const { raw, header } = stripeSigned(completed);
    const e = parseStripeWebhook(raw, header, STRIPE_SECRET);
    expect(e).toMatchObject({ kind: "payment_succeeded", orderId: completed.data.object.metadata.order_id, amount: 14900, currency: "INR", paymentId: "pi_123", providerReference: "cs_123" });
  });

  it("rejects a tampered body", () => {
    const { header } = stripeSigned(completed);
    const tampered = JSON.stringify({ ...completed, data: { object: { ...completed.data.object, amount_total: 1 } } });
    expect(() => parseStripeWebhook(tampered, header, STRIPE_SECRET)).toThrow(WebhookVerificationError);
  });

  it("rejects a missing or wrong signature", () => {
    const { raw } = stripeSigned(completed);
    expect(() => parseStripeWebhook(raw, null, STRIPE_SECRET)).toThrow(WebhookVerificationError);
    expect(() => parseStripeWebhook(raw, "t=1,v1=deadbeef", STRIPE_SECRET)).toThrow(WebhookVerificationError);
  });

  it("ignores unpaid sessions (no access for delayed payment methods until they succeed)", () => {
    const { raw, header } = stripeSigned({ ...completed, data: { object: { ...completed.data.object, payment_status: "unpaid" } } });
    expect(parseStripeWebhook(raw, header, STRIPE_SECRET).kind).toBe("ignored");
  });

  it("maps subscription events using the item period end", () => {
    const { raw, header } = stripeSigned({
      id: "evt_sub",
      object: "event",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_1", object: "subscription", status: "past_due", customer: "cus_1", cancel_at_period_end: true, metadata: { user_id: "u1", plan_id: "p1" }, items: { data: [{ current_period_end: 1893456000 }] } } },
    });
    const e = parseStripeWebhook(raw, header, STRIPE_SECRET);
    expect(e).toMatchObject({ kind: "subscription_changed", status: "past_due", cancelAtPeriodEnd: true, currentPeriodEnd: new Date(1893456000 * 1000).toISOString(), userId: "u1" });
  });
});

describe("Razorpay webhook verification", () => {
  const secret = "rzp_whsec";
  const body = {
    event: "order.paid",
    payload: {
      order: { entity: { id: "order_abc", amount_paid: 19900, currency: "INR", notes: { order_id: "22222222-2222-4222-8222-222222222222" } } },
      payment: { entity: { id: "pay_xyz", amount: 19900, currency: "INR", order_id: "order_abc" } },
    },
  };

  it("verifies the HMAC signature and maps order.paid", () => {
    const raw = JSON.stringify(body);
    const e = parseRazorpayWebhook(raw, hmacSha256Hex(secret, raw), "evt_rzp_1", secret);
    expect(e).toMatchObject({ kind: "payment_succeeded", eventId: "evt_rzp_1", orderId: "22222222-2222-4222-8222-222222222222", paymentId: "pay_xyz", amount: 19900 });
  });

  it("rejects a forged signature", () => {
    const raw = JSON.stringify(body);
    expect(() => parseRazorpayWebhook(raw, hmacSha256Hex("wrong", raw), "evt", secret)).toThrow(WebhookVerificationError);
    expect(() => parseRazorpayWebhook(raw, "not-hex", "evt", secret)).toThrow(WebhookVerificationError);
  });

  it("derives a stable event id when the header is missing", () => {
    const raw = JSON.stringify(body);
    const a = parseRazorpayWebhook(raw, hmacSha256Hex(secret, raw), null, secret);
    const b = parseRazorpayWebhook(raw, hmacSha256Hex(secret, raw), null, secret);
    expect(a.eventId).toBe(b.eventId);
  });
});

describe("development provider", () => {
  beforeEach(() => {
    vi.stubEnv("DEV_PAYMENTS_SECRET", "dev-secret");
    vi.stubEnv("APP_ENV", "development");
    resetServerEnvCache();
  });

  it("round-trips a signed simulated payment", () => {
    const { raw, signature } = signDevWebhook({ id: "devevt_1", type: "payment.succeeded", order_id: "o1", amount: 100, currency: "INR" });
    expect(parseDevWebhook(raw, signature)).toMatchObject({ kind: "payment_succeeded", amount: 100 });
    expect(() => parseDevWebhook(raw.replace("100", "1"), signature)).toThrow(WebhookVerificationError);
  });

  it("refuses to run in production", () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("PAYMENT_PROVIDER", "none");
    resetServerEnvCache();
    expect(() => signDevWebhook({ id: "x", type: "payment.failed", order_id: "o", reason: "r" })).toThrow(/disabled in production/);
  });

  it("rejects PAYMENT_PROVIDER=dev with APP_ENV=production at startup", () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("PAYMENT_PROVIDER", "dev");
    resetServerEnvCache();
    expect(() => signDevWebhook({ id: "x", type: "payment.failed", order_id: "o", reason: "r" })).toThrow(/not allowed/);
  });
});

/** In-memory store mirroring the database functions' idempotency guarantees. */
function memoryStore() {
  const events = new Map<string, string>();
  const orders = new Map([["o1", { id: "o1", user_id: "u1", amount_minor_units: 14900, currency: "INR", items: ["Glycolysis"], status: "pending", refunded: 0 }]]);
  const refunds = new Set<string>();
  const store: PaymentStore = {
    async recordEvent(e) {
      const key = `${e.provider}:${e.eventId}`;
      if (events.has(key)) return events.get(key) as "processed";
      events.set(key, "received");
      return "new";
    },
    async markEvent(provider, eventId, status) {
      events.set(`${provider}:${eventId}`, status);
    },
    async findOrderId(e) {
      return e.orderId && orders.has(e.orderId) ? e.orderId : null;
    },
    async getOrder(id) {
      return orders.get(id) ?? null;
    },
    async fulfill(a) {
      const o = orders.get(a.orderId)!;
      if (o.status === "paid") return "already_paid";
      if (o.amount_minor_units !== a.amount || o.currency !== a.currency) return "amount_mismatch";
      o.status = "paid";
      return "fulfilled";
    },
    async markUnpaid(id, status) {
      const o = orders.get(id)!;
      if (o.status !== "pending") return "ignored";
      o.status = status;
      return "updated";
    },
    async applyRefund(a) {
      if (refunds.has(a.refundId)) return "already_recorded";
      refunds.add(a.refundId);
      const o = orders.get(a.orderId)!;
      o.refunded += a.amount;
      o.status = o.refunded >= o.amount_minor_units ? "refunded" : "partially_refunded";
      return o.status;
    },
    async upsertSubscription(s) {
      return s.userId ? { userId: s.userId } : null;
    },
  };
  return { store, orders, events };
}

function notifier() {
  const calls: string[] = [];
  const n: Notifier = {
    receipt: async (o) => void calls.push(`receipt:${o.id}`),
    paymentFailed: async (o) => void calls.push(`failed:${o.id}`),
    refund: async (o, _a, _c, full) => void calls.push(`refund:${o.id}:${full}`),
    subscription: async (u, s) => void calls.push(`sub:${u}:${s}`),
    subscriptionPaymentFailed: async () => void calls.push("subfail"),
  };
  return { n, calls };
}

const paid = (eventId: string, amount = 14900): PaymentEvent => ({
  kind: "payment_succeeded",
  provider: "stripe",
  eventId,
  eventType: "checkout.session.completed",
  orderId: "o1",
  providerReference: "cs_1",
  paymentId: "pi_1",
  amount,
  currency: "INR",
  raw: {},
});

describe("payment event processing", () => {
  it("fulfils once and emails one receipt despite duplicate deliveries", async () => {
    const { store, orders } = memoryStore();
    const { n, calls } = notifier();
    expect(await processPaymentEvent(paid("evt_1"), store, n)).toMatchObject({ status: "processed", detail: "fulfilled" });
    expect(await processPaymentEvent(paid("evt_1"), store, n)).toEqual({ status: "duplicate" });
    // A different event id for the same payment (e.g. async_payment_succeeded) is still safe.
    expect(await processPaymentEvent(paid("evt_2"), store, n)).toMatchObject({ detail: "already_paid" });
    expect(orders.get("o1")!.status).toBe("paid");
    expect(calls.filter((c) => c.startsWith("receipt"))).toHaveLength(1);
  });

  it("refuses a payment whose amount does not match the order", async () => {
    const { store, orders, events } = memoryStore();
    const { n, calls } = notifier();
    expect(await processPaymentEvent(paid("evt_bad", 100), store, n)).toMatchObject({ status: "failed" });
    expect(orders.get("o1")!.status).toBe("pending");
    expect(events.get("stripe:evt_bad")).toBe("failed");
    expect(calls).toHaveLength(0);
  });

  it("does not grant access for unknown orders", async () => {
    const { store } = memoryStore();
    const { n } = notifier();
    const e = { ...paid("evt_x"), orderId: "missing" } as PaymentEvent;
    expect(await processPaymentEvent(e, store, n)).toMatchObject({ status: "failed", detail: "No matching order" });
  });

  it("records failed payments and notifies once", async () => {
    const { store, orders } = memoryStore();
    const { n, calls } = notifier();
    const failed: PaymentEvent = { kind: "payment_failed", provider: "razorpay", eventId: "f1", eventType: "payment.failed", orderId: "o1", providerReference: null, reason: "Card declined", raw: {} };
    await processPaymentEvent(failed, store, n);
    expect(orders.get("o1")!.status).toBe("failed");
    expect(calls).toEqual(["failed:o1"]);
  });

  it("applies refunds idempotently by refund id", async () => {
    const { store, orders } = memoryStore();
    const { n, calls } = notifier();
    await processPaymentEvent(paid("evt_1"), store, n);
    const refund = (eventId: string, refundId: string, amount: number): PaymentEvent => ({ kind: "refund_succeeded", provider: "stripe", eventId, eventType: "refund.updated", orderId: "o1", paymentId: "pi_1", refundId, amount, currency: "INR", raw: {} });
    await processPaymentEvent(refund("r_evt1", "re_1", 14900), store, n);
    await processPaymentEvent(refund("r_evt2", "re_1", 14900), store, n); // refund.created then refund.updated for the same refund
    expect(orders.get("o1")!.refunded).toBe(14900);
    expect(calls.filter((c) => c.startsWith("refund"))).toEqual(["refund:o1:true"]);
  });

  it("marks the event failed and rethrows when the database is unavailable", async () => {
    const { store, events } = memoryStore();
    store.fulfill = async () => {
      throw new Error("connection refused");
    };
    const { n } = notifier();
    await expect(processPaymentEvent(paid("evt_db"), store, n)).rejects.toThrow("connection refused");
    expect(events.get("stripe:evt_db")).toBe("failed");
    // A retry is allowed to process again once the database is back.
    store.fulfill = memoryStore().store.fulfill;
  });

  it("never lets an email failure undo a payment", async () => {
    const { store, orders } = memoryStore();
    const { n } = notifier();
    n.receipt = async () => {
      throw new Error("smtp down");
    };
    expect(await processPaymentEvent(paid("evt_mail"), store, n)).toMatchObject({ status: "processed" });
    expect(orders.get("o1")!.status).toBe("paid");
  });
});
