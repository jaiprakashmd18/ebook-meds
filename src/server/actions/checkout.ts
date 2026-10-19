"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { assertUser, AuthorizationError } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isCheckoutAvailable } from "@/lib/payments/config";
import { startProviderCheckout } from "@/lib/payments/checkout";
import { supabasePaymentStore, emailNotifier } from "@/lib/payments/supabase-store";
import type { ActionResult } from "./types";

const input = z.object({ productId: z.uuid(), coupon: z.string().trim().max(32).optional() });

export type RazorpayParams = {
  keyId: string;
  razorpayOrderId: string;
  orderId: string;
  amount: number;
  currency: string;
  description: string;
  prefillEmail: string | null;
};

const ERRORS: Record<string, string> = {
  product_unavailable: "This title is not available for purchase.",
  already_owned: "You already own this title. Find it in your library.",
  coupon_invalid: "That coupon code is not valid or has expired.",
  coupon_already_used: "You have already used that coupon.",
  not_authenticated: "Please sign in to continue.",
};

/**
 * Start a purchase. The price comes from the database (create_pending_order),
 * never from the client. Access is granted later, only by a verified webhook.
 */
export async function startCheckout(raw: z.input<typeof input>): Promise<ActionResult<RazorpayParams>> {
  let redirectTo: string | null = null;
  try {
    const user = await assertUser();
    const { productId, coupon } = input.parse(raw);
    const available = isCheckoutAvailable();
    if (!available.available) return { ok: false, error: `Purchases are unavailable: ${available.reason}` };

    const supabase = await createSupabaseServerClient();
    const { data: order, error } = await supabase
      .rpc("create_pending_order", { p_product: productId, p_coupon_code: coupon || null })
      .single();
    if (error || !order) {
      const key = Object.keys(ERRORS).find((k) => error?.message.includes(k));
      return { ok: false, error: key ? ERRORS[key] : "Could not start checkout. Please try again." };
    }
    const o = order as { id: string; amount_minor_units: number; currency: string };

    if (o.amount_minor_units === 0) {
      // Fully discounted: nothing to charge, so fulfil directly on the server.
      const store = supabasePaymentStore();
      const outcome = await store.fulfill({ orderId: o.id, provider: "coupon", providerReference: `coupon_${o.id}`, paymentId: null, amount: 0, currency: o.currency });
      if (outcome === "fulfilled") {
        const full = await store.getOrder(o.id);
        if (full) await emailNotifier().receipt(full).catch(() => {});
      }
      redirectTo = `/orders/${o.id}?checkout=success`;
    } else {
      const { data: item } = await supabase.from("content_items").select("id, slug, title").eq("id", productId).single();
      const start = await startProviderCheckout({
        order: o,
        product: { id: item!.id as string, slug: item!.slug as string, title: item!.title as string },
        customer: { id: user.id, email: user.email },
      });
      if (start.kind === "redirect") {
        redirectTo = start.url;
      } else {
        return {
          ok: true,
          data: {
            keyId: start.keyId,
            razorpayOrderId: start.razorpayOrderId,
            orderId: o.id,
            amount: start.amount,
            currency: start.currency,
            description: start.description,
            prefillEmail: start.prefillEmail,
          },
        };
      }
    }
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, error: e.message };
    console.error("[checkout]", e instanceof Error ? e.message : e);
    return { ok: false, error: "Could not start checkout. Please try again." };
  }
  redirect(redirectTo!);
}

/** Lightweight status check used while waiting for the webhook. */
export async function getOrderStatus(orderId: string): Promise<{ status: string } | null> {
  try {
    const user = await assertUser();
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.from("orders").select("payment_status").eq("id", z.uuid().parse(orderId)).eq("user_id", user.id).maybeSingle();
    return data ? { status: data.payment_status as string } : null;
  } catch {
    return null;
  }
}
