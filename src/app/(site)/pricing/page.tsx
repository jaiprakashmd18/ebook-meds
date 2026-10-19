import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { isDemoMode } from "@/lib/env";
import { fixturePlans } from "@/lib/data/fixtures";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSubscriptionAvailable } from "@/lib/payments/config";
import { formatMoney } from "@/lib/money";
import { Container, PageHeader } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Free notes, one-time ebook purchases, subject bundles and an optional subscription.",
  alternates: { canonical: "/pricing" },
};

async function getPlans() {
  if (isDemoMode()) return fixturePlans;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("plans")
    .select("id, name, slug, description, price_minor_units, currency, billing_interval, entitlements, active")
    .eq("active", true)
    .order("price_minor_units");
  return data ?? [];
}

const TIERS = [
  {
    name: "Free",
    price: "₹0",
    note: "No card needed",
    features: ["All free notes, in full", "Free previews of every paid title", "Bookmarks and reading progress", "Free sample PDFs where offered"],
    cta: { href: "/auth/register", label: "Create free account" },
  },
  {
    name: "Individual ebook",
    price: "Priced per title",
    note: "One-time purchase",
    features: [
      "Permanent access to the title you buy",
      "Updates to that title at no extra cost",
      "PDF download where offered",
      "Highlights and private notes",
    ],
    cta: { href: "/explore?price=paid", label: "Browse ebooks" },
  },
  {
    name: "Subject bundle",
    price: "Priced per bundle",
    note: "One-time purchase",
    features: ["A defined set of related titles", "Each included title is listed on the bundle page", "Usually less than buying separately"],
    cta: { href: "/explore?type=bundle", label: "See bundles" },
  },
];

export default async function PricingPage() {
  const plans = await getPlans();
  const subscriptionsLive = !isDemoMode() && isSubscriptionAvailable();
  const plus = plans[0];
  return (
    <Container className="py-14">
      <PageHeader eyebrow="Pricing" title="Pay only for what you need" description="Start free. Buy individual titles or bundles once and keep them. A subscription is optional." />
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {TIERS.map((t) => (
          <div key={t.name} className="flex flex-col rounded-[var(--radius-xl)] border border-border p-6">
            <h2 className="text-lg font-semibold">{t.name}</h2>
            <p className="mt-3 text-2xl font-semibold tracking-tight">{t.price}</p>
            <p className="text-sm text-muted-foreground">{t.note}</p>
            <ul className="mt-5 flex flex-1 flex-col gap-2.5">
              {t.features.map((f) => <li key={f} className="flex gap-2 text-sm"><Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden /> {f}</li>)}
            </ul>
            <Button asChild variant="outline" className="mt-6"><Link href={t.cta.href}>{t.cta.label}</Link></Button>
          </div>
        ))}
        <div className="flex flex-col rounded-[var(--radius-xl)] border-2 border-accent p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{plus?.name ?? "StudySimplify Plus"}</h2>
            {!subscriptionsLive ? <Badge tone="warning">Not yet available</Badge> : null}
          </div>
          <p className="mt-3 text-2xl font-semibold tracking-tight">
            {plus ? `${formatMoney(plus.price_minor_units, plus.currency)}` : "—"}
            <span className="text-sm font-normal text-muted-foreground"> / {plus?.billing_interval ?? "month"}</span>
          </p>
          <p className="text-sm text-muted-foreground">Access while subscribed</p>
          <ul className="mt-5 flex flex-1 flex-col gap-2.5">
            {["All subscription-eligible premium notes", "Expanded practice questions", "Cancel any time; access runs to the end of the paid period"].map((f) => (
              <li key={f} className="flex gap-2 text-sm"><Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden /> {f}</li>
            ))}
          </ul>
          {subscriptionsLive ? (
            <Button asChild className="mt-6"><Link href="/subscription">Subscribe</Link></Button>
          ) : (
            <Button className="mt-6" disabled>Coming later</Button>
          )}
        </div>
      </div>
      <div className="mt-12 grid gap-6 rounded-[var(--radius-xl)] bg-surface p-6 text-sm sm:grid-cols-2">
        <div>
          <h3 className="font-semibold">Purchases vs subscription</h3>
          <p className="mt-1 text-muted-foreground">
            A purchase is permanent access to that title. A subscription gives access to eligible titles only while it is
            active; if it ends, those titles lock again unless you bought them separately.
          </p>
        </div>
        <div>
          <h3 className="font-semibold">Refunds</h3>
          <p className="mt-1 text-muted-foreground">
            Digital products have a specific refund policy. Read the <Link href="/refund-policy" className="text-accent underline">refund policy</Link> before buying.
          </p>
        </div>
      </div>
    </Container>
  );
}
