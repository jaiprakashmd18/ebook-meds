import { requirePermission } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { AdminHeader, DataTable, Panel } from "@/components/admin/ui";
import { SalesChart } from "@/components/admin/sales-chart";
import { Stat } from "@/components/ui/misc";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Analytics" };

const RANGES = { "7": 7, "30": 30, "90": 90, "365": 365 } as const;

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string; currency?: string }> }) {
  await requirePermission("analytics.view");
  const sp = await searchParams;
  const days = RANGES[(sp.days ?? "30") as keyof typeof RANGES] ?? 30;
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  const fromDay = from.toISOString().slice(0, 10);
  const supabase = await createSupabaseServerClient();

  const [summary, items, subs, reports, metrics, purchases, searches] = await Promise.all([
    supabase.rpc("admin_sales_summary", { p_from: from.toISOString(), p_to: to.toISOString() }),
    supabase.from("content_items").select("id, title, is_free, publication_status"),
    supabase.from("subscriptions").select("id", { count: "exact", head: true }).in("status", ["active", "trialing", "past_due"]).gt("current_period_end", to.toISOString()),
    supabase.from("content_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("content_metrics_daily").select("content_item_id, preview_views, reader_opens, product_views").gte("day", fromDay),
    supabase.from("purchases").select("product_id, created_at").gte("created_at", from.toISOString()),
    supabase.from("search_queries").select("query_normalized, result_count").gte("created_at", from.toISOString()).limit(5000),
  ]);
  const sales = (summary.data ?? []) as { currency: string; paid_orders: number; pending_orders: number; failed_orders: number; gross_minor_units: number; refunded_minor_units: number; net_minor_units: number }[];
  const currency = sp.currency && sales.some((s) => s.currency === sp.currency) ? sp.currency : sales[0]?.currency ?? "INR";
  const { data: daily } = await supabase.rpc("admin_daily_sales", { p_from: from.toISOString(), p_to: to.toISOString(), p_currency: currency });
  const series = ((daily ?? []) as { day: string; paid_orders: number; gross_minor_units: number }[]).map((d) => ({ day: d.day, gross: Number(d.gross_minor_units), orders: Number(d.paid_orders) }));

  const all = (items.data ?? []) as { id: string; title: string; is_free: boolean; publication_status: string }[];
  const published = all.filter((i) => i.publication_status === "published");
  const titleOf = new Map(all.map((i) => [i.id, i.title]));

  const engagement = new Map<string, { previews: number; opens: number; views: number; sales: number }>();
  for (const m of metrics.data ?? []) {
    const e = engagement.get(m.content_item_id as string) ?? { previews: 0, opens: 0, views: 0, sales: 0 };
    e.previews += m.preview_views as number;
    e.opens += m.reader_opens as number;
    e.views += m.product_views as number;
    engagement.set(m.content_item_id as string, e);
  }
  for (const p of purchases.data ?? []) {
    const e = engagement.get(p.product_id as string) ?? { previews: 0, opens: 0, views: 0, sales: 0 };
    e.sales += 1;
    engagement.set(p.product_id as string, e);
  }
  const popular = [...engagement.entries()].sort((a, b) => b[1].sales - a[1].sales || b[1].opens - a[1].opens).slice(0, 10);

  const terms = new Map<string, { n: number; zero: number }>();
  for (const s of searches.data ?? []) {
    const t = terms.get(s.query_normalized as string) ?? { n: 0, zero: 0 };
    t.n += 1;
    if ((s.result_count as number) === 0) t.zero += 1;
    terms.set(s.query_normalized as string, t);
  }
  const topTerms = [...terms.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 15);
  const cur = sales.find((s) => s.currency === currency);

  return (
    <>
      <AdminHeader title="Analytics" description="Real recorded data only. Paid orders exclude pending and failed checkouts; amounts are never summed across currencies." />
      <form className="mb-6 flex flex-wrap gap-2">
        <label htmlFor="days" className="sr-only">Date range</label>
        <Select id="days" name="days" defaultValue={String(days)} className="h-9 w-40 text-sm">
          <option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 12 months</option>
        </Select>
        {sales.length > 1 ? (
          <Select name="currency" aria-label="Currency" defaultValue={currency} className="h-9 w-28 text-sm">
            {sales.map((s) => <option key={s.currency}>{s.currency}</option>)}
          </Select>
        ) : null}
        <Button type="submit" size="sm" variant="secondary" className="h-9">Apply</Button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={`Gross sales (${currency})`} value={formatMoney(Number(cur?.gross_minor_units ?? 0), currency)} hint={`${cur?.paid_orders ?? 0} paid orders`} />
        <Stat label="Refunds" value={formatMoney(Number(cur?.refunded_minor_units ?? 0), currency)} />
        <Stat label="Net after refunds" value={formatMoney(Number(cur?.net_minor_units ?? 0), currency)} />
        <Stat label="Pending / failed checkouts" value={`${cur?.pending_orders ?? 0} / ${cur?.failed_orders ?? 0}`} hint="Not counted as sales" />
        <Stat label="Published titles" value={published.length} hint={`${published.filter((i) => i.is_free).length} free · ${published.filter((i) => !i.is_free).length} paid`} />
        <Stat label="Active subscriptions" value={subs.count ?? 0} />
        <Stat label="Open correction reports" value={reports.count ?? 0} />
        <Stat label="Searches recorded" value={(searches.data ?? []).length} hint="Anonymous, no user IDs" />
      </div>

      <Panel title={`Daily gross sales (${currency})`} className="mt-6">
        {series.some((s) => s.gross > 0) ? <SalesChart data={series} currency={currency} /> : <p className="text-sm text-muted-foreground">No paid orders in this period.</p>}
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-accent">Table view</summary>
          <table className="mt-2 w-full text-left text-xs">
            <thead><tr><th className="py-1">Day</th><th>Paid orders</th><th>Gross</th></tr></thead>
            <tbody>{series.filter((s) => s.orders).map((s) => <tr key={s.day}><td className="py-1">{s.day}</td><td>{s.orders}</td><td>{formatMoney(s.gross, currency)}</td></tr>)}</tbody>
          </table>
        </details>
      </Panel>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 font-semibold">Popular content and preview → purchase</h2>
          <DataTable head={["Title", "Product views", "Previews", "Reader opens", "Purchases", "Conversion"]} empty={!popular.length}>
            {popular.map(([id, e]) => (
              <tr key={id}>
                <td className="px-4 py-2">{titleOf.get(id) ?? "—"}</td>
                <td className="px-4 py-2 tabular-nums">{e.views}</td>
                <td className="px-4 py-2 tabular-nums">{e.previews}</td>
                <td className="px-4 py-2 tabular-nums">{e.opens}</td>
                <td className="px-4 py-2 tabular-nums">{e.sales}</td>
                <td className="px-4 py-2 tabular-nums">{e.previews ? `${Math.round((e.sales / e.previews) * 100)}%` : "—"}</td>
              </tr>
            ))}
          </DataTable>
          <p className="mt-2 text-xs text-muted-foreground">Conversion = purchases ÷ preview views for the period, an approximation because counts are aggregate and anonymous.</p>
        </div>
        <div>
          <h2 className="mb-3 font-semibold">Top search terms</h2>
          <DataTable head={["Term", "Searches", "No results"]} empty={!topTerms.length}>
            {topTerms.map(([t, v]) => <tr key={t}><td className="px-4 py-2">{t}</td><td className="px-4 py-2 tabular-nums">{v.n}</td><td className="px-4 py-2 tabular-nums">{v.zero}</td></tr>)}
          </DataTable>
        </div>
      </div>
    </>
  );
}
