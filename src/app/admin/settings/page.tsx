import { requirePermission } from "@/lib/auth/session";
import { getServerEnv, publicEnv } from "@/lib/env";
import { isCheckoutAvailable, isSubscriptionAvailable } from "@/lib/payments/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { minorToMajorString } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { DeletionButton, PlanForm } from "@/components/admin/commerce-forms";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Settings" };

function Row({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <li className="flex items-start justify-between gap-4 py-2 text-sm">
      <span><span className="font-medium">{label}</span><span className="block text-xs text-muted-foreground">{detail}</span></span>
      <Badge tone={ok ? "success" : "warning"}>{ok ? "Configured" : "Not configured"}</Badge>
    </li>
  );
}

export default async function SettingsPage() {
  await requirePermission("settings.manage");
  const env = getServerEnv();
  const checkout = isCheckoutAvailable();
  const supabase = await createSupabaseServerClient();
  const [{ data: plans }, { data: deletions }, { data: events }] = await Promise.all([
    supabase.from("plans").select("*").order("created_at"),
    supabase.from("account_deletion_requests").select("id, user_id, reason, created_at").eq("status", "pending").order("created_at"),
    supabase.from("payment_events").select("provider, event_type, status, error, received_at").order("received_at", { ascending: false }).limit(15),
  ]);
  return (
    <>
      <AdminHeader title="Platform settings" description="Integration status reflects environment variables on this deployment. Secrets are never shown." />
      <div className="flex flex-col gap-6">
        <Panel title="Environment">
          <ul className="divide-y divide-border">
            <Row label={`App environment: ${env.APP_ENV}`} ok={env.APP_ENV === "production"} detail={`Site URL ${publicEnv.siteUrl}`} />
            <Row label="Supabase service key" ok={Boolean(env.SUPABASE_SECRET_KEY)} detail="Needed for webhooks, previews of paid notes, downloads and PDF storage" />
            <Row label={`Payments: ${env.PAYMENT_PROVIDER}`} ok={checkout.available && env.PAYMENT_PROVIDER !== "dev"} detail={checkout.available ? (env.PAYMENT_PROVIDER === "dev" ? "Development simulator — not real payments" : "Checkout enabled") : checkout.reason} />
            <Row label="Subscriptions" ok={isSubscriptionAvailable()} detail="Requires SUBSCRIPTIONS_ENABLED=true, Stripe, and an active plan with a Stripe price ID" />
            <Row label={`Email: ${env.EMAIL_PROVIDER}`} ok={env.EMAIL_PROVIDER === "resend" && Boolean(env.RESEND_API_KEY && env.EMAIL_FROM)} detail="Receipts and notifications. Auth emails are sent by Supabase Auth (configure SMTP there)." />
            <Row label="PDF buyer watermark" ok={env.PDF_WATERMARK} detail="Adds a masked licence line to paid downloads" />
          </ul>
        </Panel>

        {(plans ?? []).map((p) => (
          <Panel key={p.id as string} title={`Subscription plan: ${p.name}`} description="Prices are experiments; confirm them before launch.">
            <PlanForm
              plan={{
                id: p.id as string,
                name: p.name as string,
                description: p.description as string,
                price: minorToMajorString(p.price_minor_units as number, p.currency as string),
                currency: p.currency as string,
                billing_interval: p.billing_interval as string,
                scope: ((p.entitlements as { scope?: string }).scope ?? "subscription_eligible") as string,
                provider_price_id: p.provider_price_id as string | null,
                active: p.active as boolean,
              }}
            />
          </Panel>
        ))}

        <Panel title="Account deletion requests">
          {deletions?.length ? (
            <ul className="divide-y divide-border">
              {deletions.map((d) => (
                <li key={d.id as string} className="flex flex-col gap-2 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span>User {String(d.user_id).slice(0, 8)} · requested {formatDate(d.created_at as string)}{d.reason ? ` · “${d.reason}”` : ""}</span>
                  <DeletionButton id={d.id as string} />
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">No pending requests.</p>}
        </Panel>

        <Panel title="Recent payment webhook events">
          {events?.length ? (
            <ul className="divide-y divide-border text-sm">
              {events.map((e, i) => (
                <li key={i} className="flex justify-between gap-3 py-2">
                  <span>{e.provider as string} · {e.event_type as string}{e.error ? <span className="block text-xs text-danger">{e.error as string}</span> : null}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{e.status as string} · {formatDate(e.received_at as string, { dateStyle: "short", timeStyle: "short" })}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">No webhook events received yet.</p>}
        </Panel>
      </div>
    </>
  );
}
