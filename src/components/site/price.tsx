import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/badge";

export function PriceTag({ isFree, amount, currency, className }: { isFree: boolean; amount: number; currency: string; className?: string }) {
  if (isFree) return <Badge tone="success" className={className}>Free</Badge>;
  return <span className={className ?? "text-sm font-semibold tabular-nums"}>{formatMoney(amount, currency)}</span>;
}
