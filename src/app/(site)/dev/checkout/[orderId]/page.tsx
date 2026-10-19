import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env";
import { getOrder } from "@/lib/data/student";
import { formatMoney } from "@/lib/money";
import { Container } from "@/components/ui/misc";
import { Alert } from "@/components/ui/alert";
import { DevCheckoutButtons } from "@/components/checkout/dev-checkout";

export const metadata: Metadata = { title: "Development checkout", robots: { index: false } };

export default async function DevCheckoutPage({ params }: { params: Promise<{ orderId: string }> }) {
  const env = getServerEnv();
  if (env.PAYMENT_PROVIDER !== "dev" || env.APP_ENV === "production") notFound();
  const { orderId } = await params;
  const user = await requireUser();
  const order = await getOrder(user, orderId);
  if (!order) notFound();
  return (
    <Container className="max-w-xl py-16">
      <Alert tone="warning" title="Development payment simulator">
        This page exists only in development. No payment provider is contacted and no money moves. The buttons send a
        signed webhook through the same verification and fulfilment code that real providers use.
      </Alert>
      <div className="mt-6 rounded-[var(--radius-xl)] border-2 border-dashed border-warning p-6">
        <p className="text-sm text-muted-foreground">Order #{order.id.slice(0, 8).toUpperCase()}</p>
        <p className="mt-1 font-semibold">{order.order_items.map((i) => i.product_title_snapshot).join(", ")}</p>
        <p className="mt-3 text-2xl font-semibold tabular-nums">{formatMoney(order.amount_minor_units, order.currency)}</p>
        <p className="mt-1 text-sm">Status: {order.payment_status}</p>
        {order.payment_status === "pending" ? <DevCheckoutButtons orderId={order.id} /> : null}
      </div>
    </Container>
  );
}
