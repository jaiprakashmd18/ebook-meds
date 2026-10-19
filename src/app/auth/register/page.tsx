import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/env";
import { RegisterForm } from "@/components/site/auth-forms";
import { AuthDemoNotice } from "../demo-notice";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Create your free account</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">Save progress, bookmarks and highlights. No payment needed.</p>
      <AuthDemoNotice />
      <RegisterForm disabled={isDemoMode()} />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account? <Link href="/auth/login" className="text-accent hover:underline">Sign in</Link>
      </p>
    </>
  );
}
