import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { ResetPasswordForm } from "@/components/site/auth-forms";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPasswordPage() {
  // The recovery link signs the user in through /auth/callback first.
  if (!(await getCurrentUser())) redirect("/auth/login?error=link_invalid");
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">You will stay signed in on this device.</p>
      <ResetPasswordForm />
    </>
  );
}
