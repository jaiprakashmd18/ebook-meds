import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getItemBySlug, getItemsByIds } from "@/lib/data/catalog";
import { resolveAccess } from "@/lib/access/content";
import { isCheckoutAvailable } from "@/lib/payments/config";
import { formatMoney } from "@/lib/money";
import { Container } from "@/components/ui/misc";
import { Alert } from "@/components/ui/alert";
import { Cover } from "@/components/site/cover";
import { CheckoutForm } from "@/components/checkout/checkout-form";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ cancelled?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  await requireUser(`/checkout/${slug}`);
  const item = await getItemBySlug(slug);
  if (!item || item.is_free) notFound();
  if (item.content_type !== "bundle") {
    const access = await resolveAccess(item);
    if (access.granted) redirect(`/reader/${item.slug}`);
  }
  const checkout = isCheckoutAvailable();
  const children = item.content_type === "bundle" ? await getItemsByIds(item.bundle_item_ids ?? []) : [];
  const price = formatMoney(item.price_minor_units, item.currency);

  return (
    <Container className="max-w-3xl py-14">
      <h1 className="text-3xl font-semibold tracking-tight">Checkout</h1>
      {sp.cancelled ? <Alert tone="info" className="mt-4">Payment was cancelled. You have not been charged.</Alert> : null}
      <div className="mt-8 grid gap-8 md:grid-cols-[1fr_320px]">
        <div className="flex gap-5">
          <div className="w-28 shrink-0"><Cover item={item} size="sm" /></div>
          <div>
            <p className="font-semibold">{item.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
            {children.length ? (
              <ul className="mt-3 list-disc pl-5 text-sm">{children.map((c) => <li key={c.id}>{c.title}</li>)}</ul>
            ) : null}
            <p className="mt-3 text-sm text-muted-foreground">
              One-time purchase · permanent access to this title and its updates · <Link href="/refund-policy" className="text-accent underline">refund policy</Link>
            </p>
          </div>
        </div>
        <div className="rounded-[var(--radius-xl)] border border-border p-6">
          <div className="mb-5 flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Price</span>
            <span className="text-2xl font-semibold tabular-nums">{price}</span>
          </div>
          {checkout.available ? (
            <CheckoutForm productId={item.id} priceLabel={price} provider={checkout.provider} />
          ) : (
            <Alert tone="warning" title="Purchases are unavailable">{checkout.reason}</Alert>
          )}
        </div>
      </div>
    </Container>
  );
}
