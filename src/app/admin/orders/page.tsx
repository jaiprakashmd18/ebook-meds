import Link from "next/link";
import { requirePermission } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatMoney, minorToMajorString } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { AdminHeader, DataTable, StatusBadge } from "@/components/admin/ui";
import { RefundForm } from "@/components/admin/commerce-forms";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";

export const metadata = { title: "Orders" };
const PAGE = 50;

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  await requirePermission("orders.manage");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const statuses = ["pending", "paid", "failed", "cancelled", "refunded", "partially_refunded"];
  const supabase = await createSupabaseServerClient();
  let q = supabase
    .from("orders")
    .select("id, user_id, amount_minor_units, refunded_minor_units, currency, payment_status, provider, provider_reference, created_at, paid_at, failure_reason, order_items(product_title_snapshot)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (sp.status && statuses.includes(sp.status)) q = q.eq("payment_status", sp.status);
  const { data, count } = await q;
  const rows = (data ?? []) as unknown as {
    id: string; user_id: string | null; amount_minor_units: number; refunded_minor_units: number; currency: string; payment_status: string;
    provider: string | null; provider_reference: string | null; created_at: string; paid_at: string | null; failure_reason: string | null;
    order_items: { product_title_snapshot: string }[];
  }[];
  return (
    <>
      <AdminHeader title="Orders" description="Paid, pending and failed orders are listed separately. Development-provider orders are not real sales." />
      <form className="mb-4 flex gap-2">
        <label htmlFor="status" className="sr-only">Status</label>
        <Select id="status" name="status" defaultValue={sp.status ?? ""} className="h-9 w-48 text-sm">
          <option value="">All statuses</option>
          {statuses.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </Select>
        <Button type="submit" size="sm" variant="secondary" className="h-9">Filter</Button>
      </form>
      <DataTable head={["Order", "Items", "Amount", "Status", "Provider", "Created", ""]} empty={!rows.length}>
        {rows.map((o) => (
          <tr key={o.id} className="align-top">
            <td className="px-4 py-3 font-mono text-xs">#{o.id.slice(0, 8).toUpperCase()}<br /><span className="text-muted-foreground">{o.user_id ? <Link href={`/admin/customers?user=${o.user_id}`} className="hover:text-accent">customer</Link> : "deleted user"}</span></td>
            <td className="px-4 py-3">{o.order_items.map((i) => i.product_title_snapshot).join(", ")}{o.failure_reason ? <p className="text-xs text-danger">{o.failure_reason}</p> : null}</td>
            <td className="px-4 py-3 tabular-nums">{formatMoney(o.amount_minor_units, o.currency)}{o.refunded_minor_units ? <p className="text-xs text-muted-foreground">−{formatMoney(o.refunded_minor_units, o.currency)} refunded</p> : null}</td>
            <td className="px-4 py-3"><StatusBadge status={o.payment_status} /></td>
            <td className="px-4 py-3 text-xs">{o.provider ?? "—"}{o.provider === "dev" ? <span className="block text-warning">simulated</span> : null}</td>
            <td className="px-4 py-3 text-muted-foreground">{formatDate(o.created_at)}</td>
            <td className="px-4 py-3">
              {["paid", "partially_refunded"].includes(o.payment_status) ? <RefundForm orderId={o.id} remainingLabel={minorToMajorString(o.amount_minor_units - o.refunded_minor_units, o.currency)} /> : null}
            </td>
          </tr>
        ))}
      </DataTable>
      <Pagination page={page} pageCount={Math.max(1, Math.ceil((count ?? 0) / PAGE))} basePath="/admin/orders" params={{ status: sp.status }} />
    </>
  );
}
