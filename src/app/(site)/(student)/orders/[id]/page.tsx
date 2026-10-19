import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getOrder } from "@/lib/data/student";
import { getItemsByIds } from "@/lib/data/catalog";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/admin/ui";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { OrderStatusWatcher } from "@/components/checkout/checkout-form";

export const metadata: Metadata = { title: "Order" };

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ checkout?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser(`/orders/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const order = await getOrder(user, id);
  if (!order) notFound();
  const products = await getItemsByIds(order.order_items.map((i) => i.product_id));
  const ref = order.id.slice(0, 8).toUpperCase();
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <Link href="/orders" className="text-sm text-muted-foreground hover:text-foreground">← All orders</Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Order #{ref}</h1>
      </div>
      {order.payment_status === "pending" ? <OrderStatusWatcher orderId={order.id} initial={order.payment_status} /> : null}
      {order.payment_status === "paid" && sp.checkout === "success" ? <Alert tone="success" title="Payment confirmed">Your purchase is in your library.</Alert> : null}
      {order.payment_status === "failed" ? <Alert tone="danger" title="Payment failed">You were not charged. You can try again from the title page.</Alert> : null}
      {order.payment_status === "cancelled" ? <Alert tone="info" title="Checkout cancelled">You were not charged.</Alert> : null}
      {order.payment_status === "refunded" ? <Alert tone="info" title="Refunded">This order was refunded in full, so access to its titles has been removed.</Alert> : null}

      <dl className="grid grid-cols-2 gap-4 rounded-[var(--radius-lg)] border border-border p-5 text-sm">
        <div><dt className="text-muted-foreground">Status</dt><dd className="mt-1"><StatusBadge status={order.payment_status} /></dd></div>
        <div><dt className="text-muted-foreground">Placed</dt><dd className="mt-1">{formatDate(order.created_at, { dateStyle: "medium", timeStyle: "short" })}</dd></div>
        <div><dt className="text-muted-foreground">Paid</dt><dd className="mt-1">{order.paid_at ? formatDate(order.paid_at, { dateStyle: "medium", timeStyle: "short" }) : "—"}</dd></div>
        <div><dt className="text-muted-foreground">Payment method</dt><dd className="mt-1 capitalize">{order.provider === "dev" ? "Development simulation (not a real payment)" : order.provider ?? "—"}</dd></div>
      </dl>

      <table className="w-full text-sm">
        <tbody className="divide-y divide-border">
          {order.order_items.map((i) => (
            <tr key={i.product_id}><td className="py-2">{i.product_title_snapshot}</td><td className="py-2 text-right tabular-nums">{formatMoney(i.unit_price_minor_units, i.currency)}</td></tr>
          ))}
          {order.discount_minor_units ? <tr><td className="py-2 text-muted-foreground">Discount</td><td className="py-2 text-right tabular-nums">−{formatMoney(order.discount_minor_units, order.currency)}</td></tr> : null}
          <tr className="font-semibold"><td className="py-2">Total</td><td className="py-2 text-right tabular-nums">{formatMoney(order.amount_minor_units, order.currency)}</td></tr>
          {order.refunded_minor_units ? <tr><td className="py-2 text-muted-foreground">Refunded</td><td className="py-2 text-right tabular-nums">−{formatMoney(order.refunded_minor_units, order.currency)}</td></tr> : null}
        </tbody>
      </table>

      {order.payment_status === "paid" || order.payment_status === "partially_refunded" ? (
        <div className="flex flex-wrap gap-2">
          {products.map((p) => (
            <Button key={p.id} asChild variant="outline"><Link href={p.content_type === "bundle" ? "/library" : `/reader/${p.slug}`}>Open {p.title}</Link></Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
