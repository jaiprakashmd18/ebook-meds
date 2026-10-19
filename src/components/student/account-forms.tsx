"use client";

import { useActionState, useTransition, useState } from "react";
import { changePassword, requestAccountDeletion, updatePreferences, updateProfile, cancelSubscription, openBillingPortal, startSubscription } from "@/server/actions/account";
import { initialActionState, type ActionResult } from "@/server/actions/types";
import { Field, Input, Textarea, Checkbox } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

function Result({ state }: { state: ActionResult }) {
  if (!state.ok) return <Alert tone="danger">{state.error}</Alert>;
  if (state.message) return <Alert tone="success">{state.message}</Alert>;
  return null;
}

export function ProfileForm({ name }: { name: string }) {
  const [state, action] = useActionState(updateProfile, initialActionState);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Display name" htmlFor="displayName"><Input id="displayName" name="displayName" defaultValue={name} maxLength={80} required /></Field>
      <Result state={state} />
      <div><SubmitButton pendingLabel="Saving…">Save profile</SubmitButton></div>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePassword, initialActionState);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Current password" htmlFor="currentPassword"><Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required /></Field>
      <Field label="New password" htmlFor="newPassword" hint="At least 10 characters, with a letter and a number."><Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required /></Field>
      <Field label="Confirm new password" htmlFor="confirmPassword"><Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required /></Field>
      <Result state={state} />
      <div><SubmitButton pendingLabel="Saving…">Change password</SubmitButton></div>
    </form>
  );
}

export function PreferencesForm({ prefs }: { prefs: { content_updates: boolean; product_announcements: boolean; search_history_enabled: boolean } }) {
  const [state, action] = useActionState(updatePreferences, initialActionState);
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex items-start gap-3 text-sm"><Checkbox name="contentUpdates" defaultChecked={prefs.content_updates} className="mt-0.5" /><span><span className="font-medium">Content updates</span><span className="block text-muted-foreground">Email me when a title I own gets an important correction or new version.</span></span></label>
      <label className="flex items-start gap-3 text-sm"><Checkbox name="productAnnouncements" defaultChecked={prefs.product_announcements} className="mt-0.5" /><span><span className="font-medium">Product announcements</span><span className="block text-muted-foreground">Occasional news about new subjects and features. Off unless you opt in.</span></span></label>
      <label className="flex items-start gap-3 text-sm"><Checkbox name="searchHistory" defaultChecked={prefs.search_history_enabled} className="mt-0.5" /><span><span className="font-medium">Save my search history</span><span className="block text-muted-foreground">Shows recent searches as suggestions. Turning this off deletes saved history.</span></span></label>
      <p className="text-xs text-muted-foreground">Receipts, password resets and other account emails are always sent.</p>
      <Result state={state} />
      <div><SubmitButton pendingLabel="Saving…" variant="secondary">Save preferences</SubmitButton></div>
    </form>
  );
}

export function DeleteAccountForm({ pending }: { pending: boolean }) {
  const [state, action] = useActionState(requestAccountDeletion, initialActionState);
  if (pending || (state.ok && state.message)) {
    return <Alert tone="info">{state.ok && state.message ? state.message : "Your account deletion request is pending. Contact support if you want to cancel it."}</Alert>;
  }
  return (
    <form action={action} className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">We will delete your profile, progress, bookmarks, highlights and notes. Purchased titles cannot be restored after deletion. Order records are kept without your profile where tax law requires.</p>
      <Field label="Reason (optional)" htmlFor="reason"><Textarea id="reason" name="reason" rows={2} maxLength={2000} /></Field>
      <Field label='Type "DELETE" to confirm' htmlFor="confirm"><Input id="confirm" name="confirm" autoComplete="off" required /></Field>
      <Result state={state} />
      <div><SubmitButton variant="danger" pendingLabel="Submitting…">Request account deletion</SubmitButton></div>
    </form>
  );
}

export function SubscriptionActions({ mode, planId }: { mode: "subscribe" | "manage" | "none"; planId?: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const run = (fn: () => Promise<ActionResult>) => start(async () => setResult((await fn()) ?? null));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {mode === "subscribe" && planId ? <Button disabled={pending} onClick={() => run(() => startSubscription(planId))}>Subscribe</Button> : null}
        {mode === "manage" ? (
          <>
            <Button variant="outline" disabled={pending} onClick={() => run(openBillingPortal)}>Update payment method</Button>
            <Button variant="ghost" disabled={pending} onClick={() => { if (confirm("Cancel at the end of the current period?")) run(cancelSubscription); }}>Cancel subscription</Button>
          </>
        ) : null}
      </div>
      {result ? <Result state={result} /> : null}
    </div>
  );
}
