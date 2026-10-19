import type { Metadata } from "next";
import Link from "next/link";
import { Receipt } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getOrders } from "@/lib/data/student";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/ui/misc";
import { StatusBadge } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersPage() {
  const user = await requireUser("/orders");
  const orders = await getOrders(user);
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-semibold tracking-tight">Purchase history</h1>
      {!orders.length ? (
        <EmptyState icon={<Receipt />} title="No orders yet" description="When you buy a title, the order and receipt appear here." />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-[var(--radius-lg)] border border-border">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/orders/${o.id}`} className="flex flex-col gap-1 p-4 hover:bg-surface/60 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  <span className="font-medium">{o.order_items.map((i) => i.product_title_snapshot).join(", ")}</span>
                  <span className="block text-xs text-muted-foreground">#{o.id.slice(0, 8).toUpperCase()} · {formatDate(o.created_at)}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="tabular-nums">{formatMoney(o.amount_minor_units, o.currency)}</span>
                  <StatusBadge status={o.payment_status} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
