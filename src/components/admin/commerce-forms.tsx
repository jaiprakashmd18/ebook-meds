"use client";

import { useActionState, useState, useTransition } from "react";
import { grantAccess, notifyContentUpdate, processDeletionRequest, refundOrder, revokeGrant, saveCoupon, savePlan, setCouponActive, setUserRole } from "@/server/actions/admin/commerce";
import { initialActionState, type ActionResult } from "@/server/actions/types";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";

function Result({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  if (!state.ok) return <Alert tone="danger">{state.error}</Alert>;
  if (state.message) return <Alert tone="success">{state.message}</Alert>;
  return null;
}

function useRun() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  return { pending, result, run: (fn: () => Promise<ActionResult>) => start(async () => setResult(await fn())) };
}

export function RefundForm({ orderId, remainingLabel }: { orderId: string; remainingLabel: string }) {
  const [state, action] = useActionState(refundOrder, initialActionState);
  const [open, setOpen] = useState(false);
  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Refund…</Button>;
  return (
    <form action={action} className="flex flex-col gap-2 rounded-md border border-border p-3" onSubmit={(e) => { if (!confirm("Issue this refund? Full refunds remove access.")) e.preventDefault(); }}>
      <input type="hidden" name="orderId" value={orderId} />
      <Input name="amount" placeholder={`Amount (blank = remaining ${remainingLabel})`} inputMode="decimal" className="h-8 text-sm" aria-label="Refund amount" />
      <Input name="reason" placeholder="Reason (internal)" className="h-8 text-sm" aria-label="Refund reason" />
      <div className="flex gap-2"><SubmitButton size="sm" variant="danger" pendingLabel="Refunding…">Refund</SubmitButton><Button size="sm" variant="ghost" type="button" onClick={() => setOpen(false)}>Cancel</Button></div>
      <Result state={state.ok && !state.message ? null : state} />
    </form>
  );
}

export function CouponForm() {
  const [state, action] = useActionState(saveCoupon, initialActionState);
  const [type, setType] = useState("percent");
  return (
    <form action={action} className="grid gap-3 md:grid-cols-3">
      <Field label="Code" htmlFor="code"><Input id="code" name="code" required className="uppercase" maxLength={32} /></Field>
      <Field label="Type" htmlFor="discountType">
        <Select id="discountType" name="discountType" value={type} onChange={(e) => setType(e.target.value)}><option value="percent">Percent off</option><option value="fixed">Fixed amount off</option></Select>
      </Field>
      <Field label={type === "percent" ? "Percent (1–100)" : "Amount (major units)"} htmlFor="value"><Input id="value" name="value" required inputMode="decimal" /></Field>
      {type === "fixed" ? <Field label="Currency" htmlFor="currency"><Input id="currency" name="currency" defaultValue="INR" maxLength={3} /></Field> : null}
      <Field label="Max redemptions (optional)" htmlFor="maxRedemptions"><Input id="maxRedemptions" name="maxRedemptions" inputMode="numeric" /></Field>
      <Field label="Expires (optional)" htmlFor="expiresAt"><Input id="expiresAt" name="expiresAt" type="datetime-local" /></Field>
      <Field label="Description (internal)" htmlFor="description" className="md:col-span-3"><Input id="description" name="description" maxLength={200} /></Field>
      <div className="md:col-span-3"><SubmitButton pendingLabel="Creating…">Create coupon</SubmitButton></div>
      <div className="md:col-span-3"><Result state={state} /></div>
    </form>
  );
}

export function CouponToggle({ id, active }: { id: string; active: boolean }) {
  const { pending, run } = useRun();
  return <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setCouponActive(id, !active))}>{active ? "Deactivate" : "Activate"}</Button>;
}

export function RoleToggle({ userId, role, has, label }: { userId: string; role: "super_admin" | "content_editor" | "reviewer"; has: boolean; label: string }) {
  const { pending, result, run } = useRun();
  return (
    <span className="inline-flex flex-col">
      <label className="flex items-center gap-1.5 text-xs">
        <Checkbox checked={has} disabled={pending} onChange={(e) => { if (confirm(`${e.target.checked ? "Grant" : "Remove"} ${label}?`)) run(() => setUserRole(userId, role, e.target.checked)); }} />
        {label}
      </label>
      {result && !result.ok ? <span className="text-xs text-danger">{result.error}</span> : null}
    </span>
  );
}

export function GrantForm({ userId, items }: { userId: string; items: { id: string; title: string }[] }) {
  const [state, action] = useActionState(grantAccess, initialActionState);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="userId" value={userId} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select name="itemId" aria-label="Title" className="h-8 text-sm" defaultValue=""><option value="">Choose title…</option>{items.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}</Select>
        <Input name="reason" placeholder="Reason" aria-label="Reason" className="h-8 text-sm" />
        <Input name="expiresAt" type="date" aria-label="Expires" className="h-8 text-sm sm:w-40" />
        <SubmitButton size="sm" variant="secondary">Grant</SubmitButton>
      </div>
      <Result state={state} />
    </form>
  );
}

export function RevokeGrantButton({ id }: { id: string }) {
  const { pending, run } = useRun();
  return <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => revokeGrant(id))}>Revoke</Button>;
}

export function DeletionButton({ id }: { id: string }) {
  const { pending, result, run } = useRun();
  return (
    <span className="flex flex-col gap-1">
      <Button size="sm" variant="danger" disabled={pending} onClick={() => { if (confirm("Permanently delete this account? This cannot be undone.")) run(() => processDeletionRequest(id)); }}>Delete account</Button>
      <Result state={result} />
    </span>
  );
}

export function PlanForm({ plan }: { plan: { id: string; name: string; description: string; price: string; currency: string; billing_interval: string; scope: string; provider_price_id: string | null; active: boolean } }) {
  const [state, action] = useActionState(savePlan, initialActionState);
  return (
    <form action={action} className="grid gap-3 md:grid-cols-3">
      <input type="hidden" name="id" value={plan.id} />
      <Field label="Name" htmlFor="p-name"><Input id="p-name" name="name" defaultValue={plan.name} /></Field>
      <Field label="Price (major units)" htmlFor="p-price"><Input id="p-price" name="price" defaultValue={plan.price} inputMode="decimal" /></Field>
      <Field label="Currency" htmlFor="p-cur"><Input id="p-cur" name="currency" defaultValue={plan.currency} maxLength={3} /></Field>
      <Field label="Billing interval" htmlFor="p-int"><Select id="p-int" name="billingInterval" defaultValue={plan.billing_interval}><option value="month">Monthly</option><option value="year">Yearly</option></Select></Field>
      <Field label="Entitlement" htmlFor="p-scope"><Select id="p-scope" name="scope" defaultValue={plan.scope}><option value="subscription_eligible">Titles marked “included in subscription”</option><option value="all_premium">All paid titles (not bundles)</option></Select></Field>
      <Field label="Stripe price ID" htmlFor="p-pid" hint="Recurring price created in Stripe"><Input id="p-pid" name="providerPriceId" defaultValue={plan.provider_price_id ?? ""} /></Field>
      <Field label="Description" htmlFor="p-desc" className="md:col-span-3"><Textarea id="p-desc" name="description" defaultValue={plan.description} rows={2} /></Field>
      <label className="flex items-center gap-2 text-sm md:col-span-3"><Checkbox name="active" defaultChecked={plan.active} /> Offer this plan (requires SUBSCRIPTIONS_ENABLED=true and Stripe)</label>
      <div className="md:col-span-3"><SubmitButton pendingLabel="Saving…">Save plan</SubmitButton></div>
      <div className="md:col-span-3"><Result state={state} /></div>
    </form>
  );
}

export function NotifyUpdateButton({ itemId }: { itemId: string }) {
  const { pending, result, run } = useRun();
  return (
    <div className="flex flex-col gap-2">
      <div><Button variant="outline" size="sm" disabled={pending} onClick={() => { if (confirm("Email everyone who owns this title about the current version?")) run(() => notifyContentUpdate(itemId)); }}>Email owners about this update</Button></div>
      <Result state={result} />
    </div>
  );
}
