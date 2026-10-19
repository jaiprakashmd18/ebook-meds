import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Panel } from "@/components/admin/ui";
import { DeleteAccountForm, PasswordForm, PreferencesForm, ProfileForm } from "@/components/student/account-forms";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser("/account");
  const supabase = await createSupabaseServerClient();
  const [{ data: prefs }, { data: deletion }] = await Promise.all([
    supabase.from("notification_preferences").select("content_updates, product_announcements, search_history_enabled").eq("user_id", user.id).maybeSingle(),
    supabase.from("account_deletion_requests").select("id").eq("user_id", user.id).eq("status", "pending").maybeSingle(),
  ]);
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Account settings</h1>
        <p className="mt-1 text-muted-foreground">Signed in as {user.email}</p>
      </header>
      <Panel title="Profile"><ProfileForm name={user.displayName ?? ""} /></Panel>
      <Panel title="Email preferences" description="Notification preferences"><PreferencesForm prefs={prefs ?? { content_updates: true, product_announcements: false, search_history_enabled: false }} /></Panel>
      <Panel title="Password"><PasswordForm /></Panel>
      <Panel title="Delete account"><DeleteAccountForm pending={Boolean(deletion)} /></Panel>
    </div>
  );
}
