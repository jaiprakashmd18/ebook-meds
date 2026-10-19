import "server-only";
import { NextResponse } from "next/server";
import { isAdminClientConfigured } from "@/lib/supabase/admin";
import { parseStripeWebhook } from "./stripe";
import { parseRazorpayWebhook } from "./razorpay";
import { parseDevWebhook } from "./dev";
import { processPaymentEvent } from "./process";
import { emailNotifier, supabasePaymentStore } from "./supabase-store";
import { WebhookVerificationError, type PaymentEvent, type PaymentProviderName } from "./types";

export function parseWebhook(provider: PaymentProviderName, rawBody: string, headers: Headers): PaymentEvent {
  switch (provider) {
    case "stripe":
      return parseStripeWebhook(rawBody, headers.get("stripe-signature"));
    case "razorpay":
      return parseRazorpayWebhook(rawBody, headers.get("x-razorpay-signature"), headers.get("x-razorpay-event-id"));
    case "dev":
      return parseDevWebhook(rawBody, headers.get("x-dev-signature"));
  }
}

/** Shared webhook handler: verify, then process idempotently. */
export async function handleWebhook(provider: PaymentProviderName, rawBody: string, headers: Headers) {
  if (!isAdminClientConfigured()) {
    return NextResponse.json({ error: "Payments are not configured" }, { status: 503 });
  }
  let event: PaymentEvent;
  try {
    event = parseWebhook(provider, rawBody, headers);
  } catch (e) {
    if (e instanceof WebhookVerificationError) {
      console.warn(`[webhook:${provider}] rejected: ${e.message}`);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
    console.error(`[webhook:${provider}] could not parse`, e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  try {
    const result = await processPaymentEvent(event, supabasePaymentStore(), emailNotifier());
    // Business failures (e.g. amount mismatch) are logged in payment_events
    // for review and acknowledged, so the provider does not retry forever.
    return NextResponse.json({ received: true, result: result.status });
  } catch (e) {
    console.error(`[webhook:${provider}] processing error`, e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Temporary failure" }, { status: 500 });
  }
}
