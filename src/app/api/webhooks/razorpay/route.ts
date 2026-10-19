import type { NextRequest } from "next/server";
import { handleWebhook } from "@/lib/payments/webhook";

// Signature verification needs the exact raw request body.
export async function POST(request: NextRequest) {
  const raw = await request.text();
  return handleWebhook("razorpay", raw, request.headers);
}
