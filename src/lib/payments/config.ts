import "server-only";
import { getServerEnv, isDemoMode } from "@/lib/env";

export type ProviderName = "stripe" | "razorpay" | "dev";

/** Which checkout provider is usable right now, and why not if none. */
export function isCheckoutAvailable(): { available: true; provider: ProviderName } | { available: false; reason: string } {
  if (isDemoMode()) return { available: false, reason: "Supabase is not configured." };
  const env = getServerEnv();
  if (!env.SUPABASE_SECRET_KEY) return { available: false, reason: "SUPABASE_SECRET_KEY is required to process payments." };
  switch (env.PAYMENT_PROVIDER) {
    case "stripe":
      return env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET
        ? { available: true, provider: "stripe" }
        : { available: false, reason: "Stripe keys are missing." };
    case "razorpay":
      return env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET && env.RAZORPAY_WEBHOOK_SECRET
        ? { available: true, provider: "razorpay" }
        : { available: false, reason: "Razorpay keys are missing." };
    case "dev":
      return env.APP_ENV !== "production" && env.DEV_PAYMENTS_SECRET
        ? { available: true, provider: "dev" }
        : { available: false, reason: "Development payments need DEV_PAYMENTS_SECRET and a non-production APP_ENV." };
    default:
      return { available: false, reason: "No payment provider is configured." };
  }
}

export function isSubscriptionAvailable(): boolean {
  const env = getServerEnv();
  const checkout = isCheckoutAvailable();
  // Recurring billing is implemented for Stripe only.
  return Boolean(env.SUBSCRIPTIONS_ENABLED && checkout.available && checkout.provider === "stripe");
}
