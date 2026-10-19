"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { forgotSchema, loginSchema, registerSchema, resetSchema } from "@/lib/validation/auth";
import { safeRedirectPath } from "@/lib/utils";
import type { ActionResult } from "./types";

const NOT_CONFIGURED: ActionResult = {
  ok: false,
  error: "Accounts are unavailable in demo mode. Configure Supabase to enable sign-in (see README).",
};

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = String(i.path[0] ?? "form");
    out[key] ??= i.message;
  }
  return out;
}

async function siteOrigin() {
  // Prefer the configured canonical URL so email links never point at a
  // spoofed Host header.
  if (publicEnv.siteUrl) return publicEnv.siteUrl;
  const h = await headers();
  return `https://${h.get("host")}`;
}

export async function signIn(input: unknown): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error.issues) };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { ok: false, error: "Please confirm your email address first. Check your inbox for the verification link." };
    }
    // Same message for unknown email and wrong password.
    return { ok: false, error: "Incorrect email or password." };
  }
  redirect(safeRedirectPath(parsed.data.next));
}

export async function signUp(input: unknown): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error.issues) };
  const supabase = await createSupabaseServerClient();
  const origin = await siteOrigin();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${origin}/auth/callback?next=/dashboard`,
    },
  });
  if (error) {
    if (error.code === "weak_password") return { ok: false, error: error.message };
    if (error.code === "over_email_send_rate_limit") return { ok: false, error: "Too many attempts. Please wait a few minutes and try again." };
    return { ok: false, error: "We could not create your account. Please try again." };
  }
  if (data.session) redirect("/dashboard");
  // Email confirmation is required. The message is identical whether or not
  // the address already had an account, to avoid revealing registrations.
  return { ok: true, message: "Check your email for a link to verify your address and finish signing up." };
}

export async function requestPasswordReset(input: unknown): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = forgotSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a valid email address.", fieldErrors: fieldErrors(parsed.error.issues) };
  const supabase = await createSupabaseServerClient();
  const origin = await siteOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/auth/reset-password`,
  });
  if (error && error.code === "over_email_send_rate_limit") {
    return { ok: false, error: "Too many requests. Please wait a few minutes and try again." };
  }
  if (error) {
    console.error("[auth] resetPasswordForEmail failed", error.code);
    return { ok: false, error: "We could not send the email right now. Please try again later." };
  }
  return {
    ok: true,
    message: "If an account exists for that address, a password reset link has been sent. It expires after one hour.",
  };
}

export async function updatePassword(input: unknown): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error.issues) };
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, error: "Your reset link has expired. Request a new one." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return { ok: false, error: "Choose a password different from your current one." };
    return { ok: false, error: "We could not update your password. Please try again." };
  }
  return { ok: true, message: "Your password has been updated." };
}
