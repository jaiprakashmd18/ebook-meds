"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/money";

/** Daily gross sales for one currency. Single series: the title names it, so no legend. */
export function SalesChart({ data, currency }: { data: { day: string; gross: number; orders: number }[]; currency: string }) {
  return (
    <div className="h-64 w-full" role="img" aria-label={`Daily gross sales in ${currency}; table view below`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} />
          <XAxis dataKey="day" tickLine={false} axisLine={{ stroke: "var(--border)" }} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(d: string) => d.slice(5)} minTickGap={16} />
          <YAxis tickLine={false} axisLine={false} width={64} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v: number) => formatMoney(Math.round(v), currency)} />
          <Tooltip
            cursor={{ fill: "var(--surface)" }}
            contentStyle={{ borderRadius: 10, border: "1px solid var(--border)", fontSize: 12, color: "var(--foreground)" }}
            formatter={(value, _name, item) => [`${formatMoney(Number(value), currency)} · ${(item.payload as { orders: number }).orders} orders`, "Gross"]}
          />
          <Bar dataKey="gross" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
