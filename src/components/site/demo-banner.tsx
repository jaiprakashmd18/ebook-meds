import { isDemoMode, getServerEnv } from "@/lib/env";

/** Persistent, honest indicator of a non-production environment. */
export function EnvironmentBanner() {
  const env = getServerEnv();
  if (isDemoMode()) {
    return (
      <div role="status" className="bg-warning-soft px-4 py-2 text-center text-[13px] text-warning">
        <strong className="font-semibold">Demo mode</strong> — Supabase is not configured. You are browsing sample
        content read-only; sign-in, purchases and admin tools are disabled. See README → Setup.
      </div>
    );
  }
  if (env.PAYMENT_PROVIDER === "dev") {
    return (
      <div role="status" className="bg-warning-soft px-4 py-2 text-center text-[13px] text-warning">
        <strong className="font-semibold">Development payments</strong> — checkout uses a simulated provider. No real
        money is charged and these orders are not real sales.
      </div>
    );
  }
  return null;
}
