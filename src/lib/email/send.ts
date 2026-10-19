import "server-only";
import { getServerEnv } from "@/lib/env";
import { createSupabaseAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

export type EmailResult = { status: "sent"; id: string } | { status: "skipped"; reason: string } | { status: "failed"; reason: string };

/**
 * Send a transactional email through the configured provider and record the
 * outcome in email_log. When no provider is configured the email is NOT sent,
 * the result says so, and callers must not claim otherwise.
 */
export async function sendEmail(msg: {
  to: string;
  subject: string;
  html: string;
  text: string;
  template: string;
  userId?: string | null;
}): Promise<EmailResult> {
  const env = getServerEnv();
  let result: EmailResult;
  if (env.EMAIL_PROVIDER !== "resend" || !env.RESEND_API_KEY || !env.EMAIL_FROM) {
    result = { status: "skipped", reason: "No email provider configured" };
  } else {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: env.EMAIL_FROM, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text }),
        cache: "no-store",
      });
      if (res.ok) {
        const json = (await res.json()) as { id?: string };
        result = { status: "sent", id: json.id ?? "" };
      } else {
        result = { status: "failed", reason: `Provider responded ${res.status}` };
      }
    } catch (e) {
      result = { status: "failed", reason: e instanceof Error ? e.message : "Network error" };
    }
  }
  if (isAdminClientConfigured()) {
    await createSupabaseAdminClient()
      .from("email_log")
      .insert({
        user_id: msg.userId ?? null,
        template: msg.template,
        recipient: msg.to,
        status: result.status,
        provider_message_id: result.status === "sent" ? result.id : null,
        error: result.status === "sent" ? null : result.reason,
      })
      .then(({ error }) => error && console.error("[email] log failed", error.message));
  }
  if (result.status !== "sent") console.warn(`[email] ${msg.template} to user ${msg.userId ?? "?"} not sent: ${result.reason}`);
  return result;
}
