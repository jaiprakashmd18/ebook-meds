import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/env";
import { safeRedirectPath } from "@/lib/utils";
import { LoginForm } from "@/components/site/auth-forms";
import { Alert } from "@/components/ui/alert";
import { AuthDemoNotice } from "../demo-notice";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

const ERRORS: Record<string, string> = {
  link_invalid: "That link is invalid or has expired. Please request a new one.",
  session_expired: "Your session expired. Please sign in again.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; verified?: string }> }) {
  const sp = await searchParams;
  const next = safeRedirectPath(sp.next);
  if (await getCurrentUser()) redirect(next);
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">Welcome back. Pick up where you left off.</p>
      <AuthDemoNotice />
      {sp.error && ERRORS[sp.error] ? <Alert tone="danger" className="mb-5">{ERRORS[sp.error]}</Alert> : null}
      {sp.verified ? <Alert tone="success" className="mb-5">Your email is verified. You can sign in now.</Alert> : null}
      <LoginForm next={next} disabled={isDemoMode()} />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to StudySimplify? <Link href={`/auth/register${sp.next ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-accent hover:underline">Create a free account</Link>
      </p>
    </>
  );
}
