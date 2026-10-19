import Link from "next/link";
import { BookOpen, Download, Eye, Lock } from "lucide-react";
import { formatMoney } from "@/lib/money";
import type { CatalogItem } from "@/lib/data/types";
import type { AccessDecision } from "@/lib/access/content";
import { isDemoMode } from "@/lib/env";
import { isCheckoutAvailable } from "@/lib/payments/config";
import { Button } from "@/components/ui/button";

export function PurchasePanel({ item, access }: { item: CatalogItem; access: AccessDecision }) {
  const isBundle = item.content_type === "bundle";
  const canDownload = item.pdf_downloadable && item.has_pdf;

  if (access.granted && !isBundle) {
    return (
      <div className="flex flex-col gap-3">
        <Button asChild size="lg">
          <Link href={`/reader/${item.slug}`}><BookOpen /> {item.is_free ? "Read now — free" : "Open in reader"}</Link>
        </Button>
        {canDownload ? (
          <Button asChild variant="outline" size="lg">
            <a href={`/api/downloads/${item.slug}`}><Download /> Download PDF</a>
          </Button>
        ) : null}
        {item.is_free ? <p className="text-center text-xs text-muted-foreground">No account needed to read. Sign in to save progress.</p> : null}
      </div>
    );
  }

  const checkout = isCheckoutAvailable();
  return (
    <div className="flex flex-col gap-3">
      <p className="text-3xl font-semibold tracking-tight tabular-nums">{formatMoney(item.price_minor_units, item.currency)}</p>
      <p className="text-sm text-muted-foreground">
        One-time purchase. {isBundle ? "Unlocks every title in this bundle" : "Unlocks the full notes"} in your library
        {item.pdf_downloadable && !isBundle ? ", plus the PDF download" : ""}.
      </p>
      {checkout.available ? (
        <Button asChild size="lg">
          <Link href={`/checkout/${item.slug}`}><Lock /> Buy now</Link>
        </Button>
      ) : (
        <>
          <Button size="lg" disabled>
            <Lock /> Purchases unavailable
          </Button>
          <p className="text-xs text-muted-foreground">
            {isDemoMode()
              ? "Demo mode: payments are disabled until Supabase and a payment provider are configured."
              : "Payments are not configured on this environment yet."}
          </p>
        </>
      )}
      {!isBundle ? (
        <Button asChild variant="outline" size="lg">
          <Link href={`/preview/${item.slug}`}><Eye /> Read free preview</Link>
        </Button>
      ) : null}
      {item.subscription_eligible ? (
        <p className="text-xs text-muted-foreground">Also included with StudySimplify Plus when subscriptions are available.</p>
      ) : null}
    </div>
  );
}
