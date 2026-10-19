import Link from "next/link";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { Stat } from "@/components/ui/misc";

export const metadata = { title: "Overview" };

function last30Days() {
  const to = new Date();
  return { from: new Date(to.getTime() - 30 * 86_400_000).toISOString(), to: to.toISOString() };
}

export default async function AdminOverview() {
  const user = await requirePermission("admin.access");
  const supabase = await createSupabaseServerClient();
  const count = async (table: string, column: string, value: string) => {
    const { count: n } = await supabase.from(table).select("id", { count: "exact", head: true }).eq(column, value);
    return n ?? 0;
  };
  const [drafts, inReview, published, openReports, pendingReviews] = await Promise.all([
    count("content_items", "publication_status", "draft"),
    count("content_items", "publication_status", "review"),
    count("content_items", "publication_status", "published"),
    count("content_reports", "status", "open"),
    can(user.roles, "reviews.moderate") ? count("reviews", "moderation_status", "pending") : Promise.resolve(0),
  ]);
  let sales: { currency: string; gross_minor_units: number; net_minor_units: number; paid_orders: number }[] = [];
  if (can(user.roles, "analytics.view")) {
    const { from, to } = last30Days();
    const { data } = await supabase.rpc("admin_sales_summary", { p_from: from, p_to: to });
    sales = (data ?? []) as typeof sales;
  }
  return (
    <>
      <AdminHeader title={`Hello${user.displayName ? `, ${user.displayName}` : ""}`} description="What needs attention today." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Drafts" value={drafts} />
        <Stat label="In review" value={inReview} />
        <Stat label="Published" value={published} />
        <Stat label="Open correction reports" value={openReports} />
        <Stat label="Reviews awaiting moderation" value={pendingReviews} />
      </div>
      {can(user.roles, "analytics.view") ? (
        <Panel title="Last 30 days" className="mt-6">
          {sales.length ? (
            <ul className="grid gap-4 sm:grid-cols-3">
              {sales.map((s) => (
                <li key={s.currency} className="text-sm">
                  <p className="text-muted-foreground">{s.currency} · {s.paid_orders} paid orders</p>
                  <p className="text-xl font-semibold tabular-nums">{formatMoney(Number(s.net_minor_units), s.currency)} <span className="text-sm font-normal text-muted-foreground">net</span></p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No orders in this period.</p>
          )}
          <Link href="/admin/analytics" className="mt-4 inline-block text-sm text-accent hover:underline">Open analytics</Link>
        </Panel>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        {can(user.roles, "content.edit") ? <Link className="text-accent hover:underline" href="/admin/content/new">Create a note</Link> : null}
        <Link className="text-accent hover:underline" href="/admin/content?status=review">Items in review</Link>
        <Link className="text-accent hover:underline" href="/admin/corrections">Correction reports</Link>
      </div>
    </>
  );
}
