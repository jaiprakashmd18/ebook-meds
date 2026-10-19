import "server-only";
import { publicEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isCheckoutAvailable } from "./config";
import { createStripeCheckout } from "./stripe";
import { createRazorpayCheckout } from "./razorpay";
import { createDevCheckout } from "./dev";
import type { CheckoutContext, CheckoutStart } from "./types";

/** Create the provider checkout for a pending order and record its reference. */
export async function startProviderCheckout(ctx: Omit<CheckoutContext, "siteUrl">): Promise<CheckoutStart> {
  const available = isCheckoutAvailable();
  if (!available.available) throw new Error(available.reason);
  const full = { ...ctx, siteUrl: publicEnv.siteUrl };
  const start =
    available.provider === "stripe"
      ? await createStripeCheckout(full)
      : available.provider === "razorpay"
        ? await createRazorpayCheckout(full)
        : await createDevCheckout(full);
  const { error } = await createSupabaseAdminClient().rpc("service_attach_provider", {
    p_order: ctx.order.id,
    p_provider: available.provider,
    p_reference: start.providerReference,
  });
  if (error) throw new Error(`Could not attach provider reference: ${error.message}`);
  return start;
}
