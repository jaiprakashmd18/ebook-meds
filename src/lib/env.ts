import { z } from "zod";

/**
 * Environment handling.
 *
 * Public values (NEXT_PUBLIC_*) must be referenced statically so Next.js can
 * inline them into browser bundles. Secret values are only read in
 * server-only modules via `getServerEnv()`.
 */

export const publicEnv = {
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, ""),
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  supabasePublishableKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  appEnv: (process.env.NEXT_PUBLIC_APP_ENV || "development") as AppEnv,
};

export type AppEnv = "development" | "preview" | "production";

export function isSupabaseConfigured(): boolean {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabasePublishableKey);
}

/**
 * "Demo mode" means Supabase is not configured: public pages render the bundled
 * sample catalog read-only and every account, purchase or admin feature shows
 * a configuration notice instead of pretending to work.
 */
export function isDemoMode(): boolean {
  return !isSupabaseConfigured();
}

const booleanish = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((v) => v === "true" || v === "1");

const serverSchema = z.object({
  APP_ENV: z.enum(["development", "preview", "production"]).default("development"),
  SUPABASE_SECRET_KEY: z.string().optional(),
  PAYMENT_PROVIDER: z.enum(["none", "dev", "stripe", "razorpay"]).default("none"),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  DEV_PAYMENTS_SECRET: z.string().optional(),
  SUBSCRIPTIONS_ENABLED: booleanish,
  EMAIL_PROVIDER: z.enum(["none", "resend"]).default("none"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  PDF_WATERMARK: booleanish,
  CONTACT_EMAIL: z.string().optional(),
  DEFAULT_CURRENCY: z.string().length(3).default("INR"),
});

export type ServerEnv = z.infer<typeof serverSchema> & { SUPABASE_SECRET_KEY?: string };

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse({
    ...process.env,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER || "none",
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER || "none",
    APP_ENV: process.env.APP_ENV || process.env.NEXT_PUBLIC_APP_ENV || "development",
  });
  if (!parsed.success) {
    // Log the variable names only, never their values.
    console.error(
      "[env] Invalid server environment:",
      parsed.error.issues.map((i) => i.path.join(".")).join(", "),
    );
    throw new Error("Server environment is misconfigured. See .env.example.");
  }
  const env = parsed.data;
  if (env.APP_ENV === "production" && env.PAYMENT_PROVIDER === "dev") {
    throw new Error("PAYMENT_PROVIDER=dev is not allowed when APP_ENV=production.");
  }
  cached = env;
  return env;
}

/** Test helper: forget the memoised environment. */
export function resetServerEnvCache() {
  cached = null;
}
