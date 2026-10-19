import { formatMoney } from "@/lib/money";

/** Minimal, accessible transactional templates. All dynamic values are escaped. */

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function layout(title: string, body: string, siteUrl: string) {
  return `<!doctype html><html><body style="margin:0;background:#f5f5f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1d1d1f">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;padding:32px">
<tr><td><p style="margin:0 0 24px;font-weight:600;font-size:16px">StudySimplify</p>
<h1 style="margin:0 0 16px;font-size:22px">${escapeHtml(title)}</h1>${body}
<p style="margin:32px 0 0;font-size:12px;color:#6e6e73">You received this email because of activity on your StudySimplify account. <a href="${escapeHtml(siteUrl)}/account" style="color:#3478f6">Manage email preferences</a>.</p>
</td></tr></table></td></tr></table></body></html>`;
}

const p = (t: string) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6">${t}</p>`;
const button = (href: string, label: string) =>
  `<p style="margin:20px 0"><a href="${escapeHtml(href)}" style="background:#3478f6;color:#fff;text-decoration:none;padding:10px 18px;border-radius:999px;font-size:14px;display:inline-block">${escapeHtml(label)}</a></p>`;

export type Email = { subject: string; html: string; text: string };

export function receiptEmail(o: { orderId: string; items: string[]; amount: number; currency: string; siteUrl: string; paidAt: string }): Email {
  const total = formatMoney(o.amount, o.currency);
  const ref = o.orderId.slice(0, 8).toUpperCase();
  return {
    subject: `Your StudySimplify receipt (#${ref})`,
    html: layout(
      "Thank you for your purchase",
      p(`Order <strong>#${ref}</strong> · ${escapeHtml(new Date(o.paidAt).toUTCString())}`) +
        `<ul style="padding-left:20px;font-size:15px">${o.items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>` +
        p(`Total paid: <strong>${escapeHtml(total)}</strong>`) +
        p("Your purchase is now in your library.") +
        button(`${o.siteUrl}/library`, "Open your library"),
      o.siteUrl,
    ),
    text: `Thank you for your purchase.\nOrder #${ref}\n${o.items.join("\n")}\nTotal paid: ${total}\nOpen your library: ${o.siteUrl}/library`,
  };
}

export function paymentFailedEmail(o: { orderId: string; reason: string; siteUrl: string }): Email {
  const ref = o.orderId.slice(0, 8).toUpperCase();
  return {
    subject: `Payment not completed (#${ref})`,
    html: layout("Your payment did not go through", p(`Order #${ref} was not charged. Reason: ${escapeHtml(o.reason)}.`) + p("You can try again at any time.") + button(`${o.siteUrl}/orders/${o.orderId}`, "View order"), o.siteUrl),
    text: `Your payment for order #${ref} did not go through (${o.reason}). View: ${o.siteUrl}/orders/${o.orderId}`,
  };
}

export function refundEmail(o: { orderId: string; amount: number; currency: string; full: boolean; siteUrl: string }): Email {
  const ref = o.orderId.slice(0, 8).toUpperCase();
  const amt = formatMoney(o.amount, o.currency);
  const access = o.full ? "Access to the refunded title(s) has been removed, in line with our refund policy." : "You keep access to your purchase.";
  return {
    subject: `Refund processed (#${ref})`,
    html: layout("Your refund has been processed", p(`We refunded <strong>${escapeHtml(amt)}</strong> for order #${ref}. It may take several working days to appear on your statement.`) + p(access), o.siteUrl),
    text: `We refunded ${amt} for order #${ref}. ${access}`,
  };
}

export function subscriptionEmail(o: { status: string; periodEnd: string | null; siteUrl: string }): Email {
  const end = o.periodEnd ? new Date(o.periodEnd).toDateString() : null;
  const lines: Record<string, string> = {
    active: "Your StudySimplify Plus subscription is active.",
    trialing: "Your StudySimplify Plus trial has started.",
    past_due: "We could not take your latest subscription payment. Please update your payment method to keep access.",
    canceled: `Your subscription has been cancelled.${end ? ` Access to subscription titles ends on ${end}.` : ""}`,
    unpaid: "Your subscription is unpaid and access to subscription titles has paused.",
  };
  const line = lines[o.status] ?? `Your subscription status changed to ${o.status}.`;
  return {
    subject: "Your StudySimplify subscription",
    html: layout("Subscription update", p(escapeHtml(line)) + button(`${o.siteUrl}/subscription`, "Manage subscription"), o.siteUrl),
    text: `${line}\nManage: ${o.siteUrl}/subscription`,
  };
}

export function contentUpdateEmail(o: { title: string; version: number; summary: string | null; slug: string; siteUrl: string }): Email {
  return {
    subject: `Updated: ${o.title} (version ${o.version})`,
    html: layout(`${o.title} has been updated`, p(`Version ${o.version} is now available in your library.`) + (o.summary ? p(`What changed: ${escapeHtml(o.summary)}`) : "") + button(`${o.siteUrl}/reader/${o.slug}`, "Read the update"), o.siteUrl),
    text: `${o.title} version ${o.version} is available.${o.summary ? ` What changed: ${o.summary}` : ""} ${o.siteUrl}/reader/${o.slug}`,
  };
}
