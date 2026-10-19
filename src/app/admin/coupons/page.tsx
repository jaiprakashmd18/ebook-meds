import { requirePermission } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { AdminHeader, DataTable, Panel, StatusBadge } from "@/components/admin/ui";
import { CouponForm, CouponToggle } from "@/components/admin/commerce-forms";

export const metadata = { title: "Coupons" };

export default async function CouponsPage() {
  await requirePermission("coupons.manage");
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
  const rows = (data ?? []) as { id: string; code: string; description: string | null; discount_type: string; discount_value: number; currency: string | null; max_redemptions: number | null; redemption_count: number; expires_at: string | null; active: boolean }[];
  return (
    <>
      <AdminHeader title="Coupons" description="Discounts are applied on the server when the order is created. Redemptions are counted only after payment." />
      <Panel title="New coupon" className="mb-6"><CouponForm /></Panel>
      <DataTable head={["Code", "Discount", "Used", "Expires", "Status", ""]} empty={!rows.length}>
        {rows.map((c) => (
          <tr key={c.id}>
            <td className="px-4 py-3 font-mono">{c.code}<p className="font-sans text-xs text-muted-foreground">{c.description}</p></td>
            <td className="px-4 py-3">{c.discount_type === "percent" ? `${c.discount_value}%` : formatMoney(c.discount_value, c.currency ?? "INR")}</td>
            <td className="px-4 py-3 tabular-nums">{c.redemption_count}{c.max_redemptions ? ` / ${c.max_redemptions}` : ""}</td>
            <td className="px-4 py-3">{c.expires_at ? formatDate(c.expires_at) : "Never"}</td>
            <td className="px-4 py-3"><StatusBadge status={c.active ? "active" : "revoked"} /></td>
            <td className="px-4 py-3"><CouponToggle id={c.id} active={c.active} /></td>
          </tr>
        ))}
      </DataTable>
    </>
  );
}
