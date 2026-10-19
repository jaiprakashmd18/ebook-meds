"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { getServerEnv } from "@/lib/env";
import { assertUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signDevWebhook } from "@/lib/payments/dev";
import { handleWebhook } from "@/lib/payments/webhook";

/**
 * Development only: simulate the provider calling our webhook. The signed
 * payload goes through handleWebhook, exactly like a real delivery.
 */
export async function simulateDevPayment(orderId: string, outcome: "succeeded" | "failed") {
  const env = getServerEnv();
  if (env.PAYMENT_PROVIDER !== "dev" || env.APP_ENV === "production") throw new Error("Not available");
  const user = await assertUser();
  const id = z.uuid().parse(orderId);
  const supabase = await createSupabaseServerClient();
  const { data: order } = await supabase.from("orders").select("id, amount_minor_units, currency").eq("id", id).eq("user_id", user.id).single();
  if (!order) throw new Error("Order not found");
  const body =
    outcome === "succeeded"
      ? { id: `devevt_${crypto.randomUUID()}`, type: "payment.succeeded" as const, order_id: id, amount: order.amount_minor_units as number, currency: order.currency as string }
      : { id: `devevt_${crypto.randomUUID()}`, type: "payment.failed" as const, order_id: id, reason: "Simulated card decline" };
  const { raw, signature } = signDevWebhook(body);
  await handleWebhook("dev", raw, new Headers({ "x-dev-signature": signature }));
  redirect(`/orders/${id}${outcome === "succeeded" ? "?checkout=success" : ""}`);
}
