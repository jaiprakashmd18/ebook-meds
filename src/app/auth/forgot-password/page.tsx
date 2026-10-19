import type { Metadata } from "next";
import Link from "next/link";
import { isDemoMode } from "@/lib/env";
import { ForgotPasswordForm } from "@/components/site/auth-forms";
import { AuthDemoNotice } from "../demo-notice";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">We will email you a link to choose a new password.</p>
      <AuthDemoNotice />
      <ForgotPasswordForm disabled={isDemoMode()} />
      <p className="mt-6 text-center text-sm"><Link href="/auth/login" className="text-accent hover:underline">Back to sign in</Link></p>
    </>
  );
}
