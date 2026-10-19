import { isDemoMode } from "@/lib/env";
import { Alert } from "@/components/ui/alert";

export function AuthDemoNotice() {
  if (!isDemoMode()) return null;
  return (
    <Alert tone="warning" title="Accounts are disabled in demo mode" className="mb-5">
      Supabase is not configured, so sign-in cannot work here. Free notes are readable without an account.
    </Alert>
  );
}
