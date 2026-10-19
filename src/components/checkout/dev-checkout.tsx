"use client";

import { useTransition } from "react";
import { simulateDevPayment } from "@/server/actions/dev-payments";
import { Button } from "@/components/ui/button";

export function DevCheckoutButtons({ orderId }: { orderId: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="mt-6 flex flex-wrap gap-2">
      <Button disabled={pending} onClick={() => start(() => simulateDevPayment(orderId, "succeeded"))}>Simulate successful payment</Button>
      <Button variant="outline" disabled={pending} onClick={() => start(() => simulateDevPayment(orderId, "failed"))}>Simulate failed payment</Button>
    </div>
  );
}
