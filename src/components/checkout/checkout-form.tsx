"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Loader2, Lock } from "lucide-react";
import { getOrderStatus, startCheckout, type RazorpayParams } from "@/server/actions/checkout";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

type RazorpayInstance = { open: () => void; on: (event: string, cb: (r: unknown) => void) => void };
declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => RazorpayInstance;
  }
}

export function CheckoutForm({ productId, priceLabel, provider }: { productId: string; priceLabel: string; provider: "stripe" | "razorpay" | "dev" }) {
  const router = useRouter();
  const [coupon, setCoupon] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const openRazorpay = (p: RazorpayParams) => {
    if (!window.Razorpay) {
      setError("The payment window could not load. Check your connection or disable blockers and try again.");
      return;
    }
    const rzp = new window.Razorpay({
      key: p.keyId,
      order_id: p.razorpayOrderId,
      amount: p.amount,
      currency: p.currency,
      name: "StudySimplify",
      description: p.description,
      prefill: p.prefillEmail ? { email: p.prefillEmail } : undefined,
      theme: { color: "#3478F6" },
      // The browser callback is NOT proof of payment; access is granted only
      // after our server receives Razorpay's signed webhook.
      handler: () => router.push(`/orders/${p.orderId}?checkout=success`),
      modal: { ondismiss: () => router.push(`/orders/${p.orderId}`) },
    });
    rzp.on("payment.failed", () => router.push(`/orders/${p.orderId}`));
    rzp.open();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await startCheckout({ productId, coupon: coupon.trim() || undefined });
          if (!res) return; // redirected
          if (!res.ok) setError(res.error);
          else if (res.data) openRazorpay(res.data);
        });
      }}
      className="flex flex-col gap-4"
    >
      {provider === "razorpay" ? <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" /> : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="coupon">Coupon code (optional)</Label>
        <Input id="coupon" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} maxLength={32} autoComplete="off" className="uppercase" />
      </div>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Lock />} Pay {priceLabel}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        {provider === "dev"
          ? "Development mode: you will see a simulated payment page. No money is charged."
          : `You will complete payment securely with ${provider === "stripe" ? "Stripe" : "Razorpay"}. The final amount, including any discount, is confirmed there.`}
      </p>
    </form>
  );
}

export function OrderStatusWatcher({ orderId, initial }: { orderId: string; initial: string }) {
  const router = useRouter();
  const [status, setStatus] = useState(initial);
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    if (status !== "pending") return;
    let attempts = 0;
    let cancelled = false;
    const timer = setInterval(async () => {
      attempts += 1;
      const res = await getOrderStatus(orderId);
      if (cancelled) return;
      if (res && res.status !== "pending") {
        setStatus(res.status);
        clearInterval(timer);
        router.refresh();
      } else if (attempts >= 20) {
        setGaveUp(true);
        clearInterval(timer);
      }
    }, 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [orderId, router, status]);

  if (status !== "pending") return null;
  return (
    <Alert tone="info" title="Waiting for payment confirmation">
      {!gaveUp
        ? "We grant access as soon as the payment provider confirms your payment to us. This usually takes a few seconds."
        : "Confirmation is taking longer than usual. If you completed payment, it will appear shortly; refresh this page later or contact us with your order number."}
    </Alert>
  );
}
