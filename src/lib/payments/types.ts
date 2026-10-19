/** Provider-neutral payment types. */

export type PaymentProviderName = "stripe" | "razorpay" | "dev";

export type CheckoutOrder = {
  id: string;
  amount_minor_units: number;
  currency: string;
};

export type CheckoutContext = {
  order: CheckoutOrder;
  product: { id: string; slug: string; title: string };
  customer: { id: string; email: string | null };
  siteUrl: string;
};

export type CheckoutStart =
  | { kind: "redirect"; url: string; providerReference: string }
  | {
      kind: "razorpay";
      providerReference: string;
      keyId: string;
      razorpayOrderId: string;
      amount: number;
      currency: string;
      description: string;
      prefillEmail: string | null;
    };

/** A verified webhook event, normalised across providers. */
export type PaymentEvent =
  | {
      kind: "payment_succeeded";
      provider: PaymentProviderName;
      eventId: string;
      eventType: string;
      orderId: string | null;
      providerReference: string | null;
      paymentId: string | null;
      amount: number;
      currency: string;
      raw: unknown;
    }
  | {
      kind: "payment_failed" | "checkout_expired";
      provider: PaymentProviderName;
      eventId: string;
      eventType: string;
      orderId: string | null;
      providerReference: string | null;
      reason: string;
      raw: unknown;
    }
  | {
      kind: "refund_succeeded";
      provider: PaymentProviderName;
      eventId: string;
      eventType: string;
      orderId: string | null;
      paymentId: string | null;
      refundId: string;
      amount: number;
      currency: string;
      raw: unknown;
    }
  | {
      kind: "subscription_changed";
      provider: PaymentProviderName;
      eventId: string;
      eventType: string;
      userId: string | null;
      planId: string | null;
      subscriptionId: string;
      customerId: string | null;
      status: "incomplete" | "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "expired";
      currentPeriodEnd: string | null;
      cancelAtPeriodEnd: boolean;
      raw: unknown;
    }
  | {
      kind: "subscription_payment_failed";
      provider: PaymentProviderName;
      eventId: string;
      eventType: string;
      subscriptionId: string | null;
      customerEmail: string | null;
      raw: unknown;
    }
  | { kind: "ignored"; provider: PaymentProviderName; eventId: string; eventType: string; raw: unknown };

export class WebhookVerificationError extends Error {
  constructor(message = "Invalid webhook signature") {
    super(message);
    this.name = "WebhookVerificationError";
  }
}
