import { z } from "zod";
import { CONTENT_TYPES, DIFFICULTIES } from "@/lib/data/types";
import { parseMajorToMinor } from "@/lib/money";

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Use at least 3 characters")
  .max(80)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single dashes");

const lines = z
  .string()
  .max(10000)
  .transform((v) => v.split("\n").map((s) => s.trim()).filter(Boolean))
  .pipe(z.array(z.string().max(500)).max(30));

const tags = z
  .string()
  .max(1000)
  .transform((v) => [...new Set(v.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean))])
  .pipe(z.array(z.string().max(40, "Tags must be 40 characters or fewer")).max(20, "Use at most 20 tags"));

export const contentMetaSchema = z
  .object({
    title: z.string().trim().min(3, "Title is too short").max(200),
    slug,
    subtitle: z.string().trim().max(300).optional(),
    description: z.string().trim().min(10, "Write a short description (10+ characters)").max(2000),
    subjectId: z.uuid("Choose a subject"),
    topicId: z.uuid().optional().or(z.literal("")),
    contentType: z.enum(CONTENT_TYPES),
    difficulty: z.enum(DIFFICULTIES),
    isFree: z.boolean(),
    price: z.string().trim().max(12).optional(),
    currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code"),
    subscriptionEligible: z.boolean(),
    byline: z.string().trim().max(200).optional(),
    learningObjectives: lines,
    tags,
    pdfDownloadable: z.boolean(),
    featured: z.boolean(),
    bundleItemIds: z.array(z.uuid()).max(50).optional(),
  })
  .transform((v, ctx) => {
    let priceMinor = 0;
    if (!v.isFree) {
      const parsed = v.price ? parseMajorToMinor(v.price, v.currency) : null;
      if (parsed === null || parsed <= 0) {
        ctx.addIssue({ code: "custom", message: "Enter a price above 0, e.g. 149 or 149.50", path: ["price"] });
        return z.NEVER;
      }
      priceMinor = parsed;
    }
    if (v.contentType === "bundle") {
      if (v.isFree) {
        ctx.addIssue({ code: "custom", message: "Bundles must be paid", path: ["isFree"] });
        return z.NEVER;
      }
    }
    return { ...v, priceMinor };
  });

export type ContentMetaInput = z.input<typeof contentMetaSchema>;

export const subjectSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  slug,
  description: z.string().trim().max(2000).default(""),
  published: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(1000),
});

export const topicSchema = z.object({
  subjectId: z.uuid(),
  name: z.string().trim().min(1).max(120),
  slug,
});

export const couponSchema = z
  .object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,32}$/, "3–32 letters, numbers, dashes or underscores"),
    description: z.string().trim().max(200).optional(),
    discountType: z.enum(["percent", "fixed"]),
    value: z.string().trim(),
    currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).default("INR"),
    maxRedemptions: z.string().trim().optional(),
    expiresAt: z.string().trim().optional(),
  })
  .transform((v, ctx) => {
    let discountValue: number | null;
    if (v.discountType === "percent") {
      discountValue = /^\d{1,3}$/.test(v.value) ? Number(v.value) : null;
      if (!discountValue || discountValue > 100) {
        ctx.addIssue({ code: "custom", message: "Percent must be between 1 and 100", path: ["value"] });
        return z.NEVER;
      }
    } else {
      discountValue = parseMajorToMinor(v.value, v.currency);
      if (!discountValue) {
        ctx.addIssue({ code: "custom", message: "Enter an amount above 0", path: ["value"] });
        return z.NEVER;
      }
    }
    const max = v.maxRedemptions ? Number(v.maxRedemptions) : null;
    if (max !== null && (!Number.isInteger(max) || max < 1)) {
      ctx.addIssue({ code: "custom", message: "Use a whole number of 1 or more", path: ["maxRedemptions"] });
      return z.NEVER;
    }
    const expires = v.expiresAt ? new Date(v.expiresAt) : null;
    if (expires && Number.isNaN(expires.getTime())) {
      ctx.addIssue({ code: "custom", message: "Invalid date", path: ["expiresAt"] });
      return z.NEVER;
    }
    return {
      code: v.code,
      description: v.description || null,
      discount_type: v.discountType,
      discount_value: discountValue,
      currency: v.discountType === "fixed" ? v.currency : null,
      max_redemptions: max,
      expires_at: expires ? expires.toISOString() : null,
    };
  });
