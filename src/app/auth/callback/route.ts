import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { safeRedirectPath } from "@/lib/utils";

const OTP_TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

/**
 * Completes email verification, password recovery and OAuth flows.
 * Supports both the PKCE `code` parameter and `token_hash` links.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeRedirectPath(url.searchParams.get("next"));
  const fail = NextResponse.redirect(new URL("/auth/login?error=link_invalid", url.origin));
  if (!isSupabaseConfigured()) return fail;

  const supabase = await createSupabaseServerClient();
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail;
  } else if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return fail;
  } else {
    return fail;
  }
  const destination = type === "recovery" ? "/auth/reset-password" : next;
  return NextResponse.redirect(new URL(destination, url.origin));
}
