import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getSubscription, subscriptionIsActive } from "@/lib/data/student";
import { isSubscriptionAvailable } from "@/lib/payments/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { Panel, StatusBadge } from "@/components/admin/ui";
import { Alert } from "@/components/ui/alert";
import { SubscriptionActions } from "@/components/student/account-forms";

export const metadata: Metadata = { title: "Subscription" };

export default async function SubscriptionPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const user = await requireUser("/subscription");
  const sp = await searchParams;
  const sub = await getSubscription(user);
  const active = subscriptionIsActive(sub);
  const available = isSubscriptionAvailable();
  const supabase = await createSupabaseServerClient();
  const { data: plan } = await supabase.from("plans").select("id, name, price_minor_units, currency, billing_interval, description").eq("active", true).order("price_minor_units").limit(1).maybeSingle();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">Subscription</h1>
      {sp.checkout === "success" ? <Alert tone="info" title="Thanks!">Your subscription will show as active once the payment provider confirms it. This usually takes a few seconds — refresh the page.</Alert> : null}
      {sub ? (
        <Panel title={sub.plans?.name ?? "Subscription"}>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-muted-foreground">Status</dt><dd className="mt-1"><StatusBadge status={active ? (sub.cancel_at_period_end ? "cancelling" : sub.status) : sub.status} /></dd></div>
            <div><dt className="text-muted-foreground">{sub.cancel_at_period_end || !active ? "Access ends" : "Renews"}</dt><dd className="mt-1">{formatDate(sub.current_period_end)}</dd></div>
            {sub.plans ? <div><dt className="text-muted-foreground">Price</dt><dd className="mt-1">{formatMoney(sub.plans.price_minor_units, sub.plans.currency)} / {sub.plans.billing_interval}</dd></div> : null}
          </dl>
          {sub.status === "past_due" ? <Alert tone="warning" className="mt-4">Your last payment failed. Update your payment method to keep access after {formatDate(sub.current_period_end)}.</Alert> : null}
          <p className="mt-4 text-sm text-muted-foreground">Subscription access covers subscription-eligible titles only while active. Titles you bought separately stay in your library permanently.</p>
          {active && !sub.cancel_at_period_end ? <div className="mt-4"><SubscriptionActions mode="manage" /></div> : null}
        </Panel>
      ) : null}
      {!active ? (
        available && plan ? (
          <Panel title={plan.name as string} description={plan.description as string}>
            <p className="text-2xl font-semibold">{formatMoney(plan.price_minor_units as number, plan.currency as string)} <span className="text-sm font-normal text-muted-foreground">/ {plan.billing_interval as string}</span></p>
            <div className="mt-4"><SubscriptionActions mode="subscribe" planId={plan.id as string} /></div>
          </Panel>
        ) : (
          <Alert tone="info" title="Subscriptions are not available yet">
            StudySimplify Plus will launch once recurring billing is configured and tested. Free notes and individual purchases are available now. <Link href="/pricing">See pricing</Link>.
          </Alert>
        )
      ) : null}
    </div>
  );
}
