"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm, type FieldValues, type Path, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { requestPasswordReset, signIn, signUp, updatePassword } from "@/server/actions/auth";
import type { ActionResult } from "@/server/actions/types";
import { forgotSchema, loginSchema, registerSchema, resetSchema } from "@/lib/validation/auth";
import { Field, Input, Checkbox } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

function useActionForm<S extends z.ZodType<FieldValues, FieldValues>>(
  schema: S,
  action: (values: unknown) => Promise<ActionResult>,
  defaults: Partial<z.input<S>>,
) {
  const form = useForm<z.input<S>, unknown, z.output<S>>({
    resolver: zodResolver(schema as never),
    defaultValues: defaults as never,
  });
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const onSubmit = form.handleSubmit((values) =>
    start(async () => {
      setResult(null);
      const res = await action(values);
      if (res && !res.ok && res.fieldErrors) {
        for (const [k, msg] of Object.entries(res.fieldErrors)) form.setError(k as Path<z.input<S>>, { message: msg });
      }
      if (res) setResult(res);
    }),
  );
  return { form, result, pending, onSubmit };
}

function TextField<T extends FieldValues>({
  form,
  name,
  label,
  type = "text",
  autoComplete,
  hint,
}: {
  form: UseFormReturn<T, unknown, unknown>;
  name: Path<T>;
  label: string;
  type?: string;
  autoComplete?: string;
  hint?: string;
}) {
  const err = form.formState.errors[name]?.message as string | undefined;
  return (
    <Field label={label} htmlFor={name} error={err} hint={hint}>
      <Input
        id={name}
        type={type}
        autoComplete={autoComplete}
        aria-invalid={Boolean(err)}
        aria-describedby={err ? `${name}-error` : undefined}
        {...form.register(name)}
      />
    </Field>
  );
}

function Pending({ pending, children, label }: { pending: boolean; children: React.ReactNode; label: string }) {
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending} aria-busy={pending}>
      {pending ? <><Loader2 className="animate-spin" aria-hidden /> {label}</> : children}
    </Button>
  );
}

export function LoginForm({ next, disabled }: { next?: string; disabled?: boolean }) {
  const { form, result, pending, onSubmit } = useActionForm(loginSchema, signIn, { email: "", password: "", next });
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <fieldset disabled={disabled} className="flex flex-col gap-4">
        <TextField form={form} name="email" label="Email" type="email" autoComplete="email" />
        <TextField form={form} name="password" label="Password" type="password" autoComplete="current-password" />
        <div className="-mt-1 text-right">
          <Link href="/auth/forgot-password" className="text-sm text-accent hover:underline">Forgot password?</Link>
        </div>
        {result && !result.ok ? <Alert tone="danger">{result.error}</Alert> : null}
        <Pending pending={pending} label="Signing in…">Sign in</Pending>
      </fieldset>
    </form>
  );
}

export function RegisterForm({ disabled }: { disabled?: boolean }) {
  const { form, result, pending, onSubmit } = useActionForm(registerSchema, signUp, {
    displayName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  if (result?.ok && result.message) {
    return <Alert tone="success" title="Almost there">{result.message}</Alert>;
  }
  const termsErr = form.formState.errors.acceptTerms?.message as string | undefined;
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <fieldset disabled={disabled} className="flex flex-col gap-4">
        <TextField form={form} name="displayName" label="Name" autoComplete="name" />
        <TextField form={form} name="email" label="Email" type="email" autoComplete="email" />
        <TextField form={form} name="password" label="Password" type="password" autoComplete="new-password" hint="At least 10 characters, with a letter and a number." />
        <TextField form={form} name="confirmPassword" label="Confirm password" type="password" autoComplete="new-password" />
        <div className="flex flex-col gap-1">
          <label className="flex items-start gap-2.5 text-sm">
            <Checkbox className="mt-0.5" {...form.register("acceptTerms")} aria-invalid={Boolean(termsErr)} />
            <span>
              I agree to the <Link href="/terms" className="text-accent underline">terms</Link> and have read the{" "}
              <Link href="/privacy" className="text-accent underline">privacy policy</Link>.
            </span>
          </label>
          {termsErr ? <p role="alert" className="text-[13px] text-danger">{termsErr}</p> : null}
        </div>
        {result && !result.ok ? <Alert tone="danger">{result.error}</Alert> : null}
        <Pending pending={pending} label="Creating account…">Create free account</Pending>
      </fieldset>
    </form>
  );
}

export function ForgotPasswordForm({ disabled }: { disabled?: boolean }) {
  const { form, result, pending, onSubmit } = useActionForm(forgotSchema, requestPasswordReset, { email: "" });
  if (result?.ok && result.message) return <Alert tone="success" title="Check your email">{result.message}</Alert>;
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <fieldset disabled={disabled} className="flex flex-col gap-4">
        <TextField form={form} name="email" label="Email" type="email" autoComplete="email" />
        {result && !result.ok ? <Alert tone="danger">{result.error}</Alert> : null}
        <Pending pending={pending} label="Sending…">Send reset link</Pending>
      </fieldset>
    </form>
  );
}

export function ResetPasswordForm() {
  const { form, result, pending, onSubmit } = useActionForm(resetSchema, updatePassword, { password: "", confirmPassword: "" });
  if (result?.ok && result.message) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="success">{result.message}</Alert>
        <Button asChild><Link href="/dashboard">Go to dashboard</Link></Button>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <TextField form={form} name="password" label="New password" type="password" autoComplete="new-password" hint="At least 10 characters, with a letter and a number." />
      <TextField form={form} name="confirmPassword" label="Confirm new password" type="password" autoComplete="new-password" />
      {result && !result.ok ? <Alert tone="danger">{result.error}</Alert> : null}
      <Pending pending={pending} label="Saving…">Update password</Pending>
    </form>
  );
}
