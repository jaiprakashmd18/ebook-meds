import Link from "next/link";
import { Check, Lock } from "lucide-react";
import type { CatalogItem } from "@/lib/data/types";
import type { AccessDecision } from "@/lib/access/content";
import { formatMoney } from "@/lib/money";
import { isCheckoutAvailable } from "@/lib/payments/config";
import { Button } from "@/components/ui/button";

export function Paywall({
  item,
  access,
  lockedSections,
}: {
  item: CatalogItem;
  access: AccessDecision;
  lockedSections: string[];
}) {
  const checkout = isCheckoutAvailable();
  return (
    <section aria-labelledby="paywall-title" className="my-12 rounded-[var(--radius-xl)] border border-[var(--reader-border,var(--border))] bg-[var(--reader-panel,var(--surface))] p-6 sm:p-8">
      <div className="flex items-center gap-2 text-sm font-medium text-accent">
        <Lock className="size-4" aria-hidden /> End of free preview
      </div>
      <h2 id="paywall-title" className="mt-2 text-2xl font-semibold tracking-tight">Unlock the full notes</h2>
      <p className="mt-2 text-[var(--reader-muted,var(--muted-foreground))]">{item.description}</p>
      {lockedSections.length ? (
        <>
          <p className="mt-5 text-sm font-medium">After purchase you also get:</p>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {lockedSections.map((t) => (
              <li key={t} className="flex gap-2 text-sm"><Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> {t}</li>
            ))}
            {item.pdf_downloadable ? <li className="flex gap-2 text-sm"><Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> Downloadable PDF</li> : null}
          </ul>
        </>
      ) : null}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <p className="mr-2 text-2xl font-semibold tabular-nums">{formatMoney(item.price_minor_units, item.currency)}</p>
        {access.reason === "unauthenticated" && checkout.available ? (
          <Button asChild size="lg"><Link href={`/auth/login?next=${encodeURIComponent(`/checkout/${item.slug}`)}`}>Sign in to buy</Link></Button>
        ) : checkout.available ? (
          <Button asChild size="lg"><Link href={`/checkout/${item.slug}`}>Buy now</Link></Button>
        ) : (
          <Button size="lg" disabled>Purchases unavailable</Button>
        )}
        <Button asChild variant="ghost"><Link href={`/notes/${item.slug}`}>Product details</Link></Button>
      </div>
      <p className="mt-4 text-xs text-[var(--reader-muted,var(--muted-foreground))]">
        One-time purchase. Access is added to your library as soon as the payment provider confirms payment.
        {access.reason === "not_entitled" ? " Already bought it? It may take a moment to appear — refresh this page." : ""}
      </p>
    </section>
  );
}
