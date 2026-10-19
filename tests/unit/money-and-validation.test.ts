import { describe, expect, it } from "vitest";
import { computeDiscount, formatMoney, minorToMajorString, parseMajorToMinor } from "@/lib/money";
import { couponSchema, contentMetaSchema } from "@/lib/validation/admin";
import { loginSchema, registerSchema } from "@/lib/validation/auth";
import { parseCatalogParams } from "@/lib/validation/catalog";
import { safeRedirectPath } from "@/lib/utils";
import { can, isStaff } from "@/lib/auth/roles";
import { detectImageType, isPdf } from "@/lib/files";
import { searchFixtures } from "@/lib/data/fixture-search";
import { fixtureItems } from "@/lib/data/fixtures";

describe("money", () => {
  it("parses major units without floating point error", () => {
    expect(parseMajorToMinor("149", "INR")).toBe(14900);
    expect(parseMajorToMinor("0.1", "INR")).toBe(10);
    expect(parseMajorToMinor("19.99", "USD")).toBe(1999);
    expect(parseMajorToMinor("1.234", "INR")).toBeNull();
    expect(parseMajorToMinor("-5", "INR")).toBeNull();
    expect(parseMajorToMinor("abc", "INR")).toBeNull();
    expect(minorToMajorString(14950, "INR")).toBe("149.50");
    expect(minorToMajorString(5, "INR")).toBe("0.05");
  });

  it("formats integer minor units and refuses fractions", () => {
    expect(formatMoney(14900, "INR")).toBe("₹149");
    expect(formatMoney(14950, "INR")).toBe("₹149.50");
    expect(() => formatMoney(1.5, "INR")).toThrow();
  });

  it("computes discounts conservatively", () => {
    expect(computeDiscount(12900, { type: "percent", value: 10 })).toBe(1290);
    expect(computeDiscount(999, { type: "percent", value: 33 })).toBe(329);
    expect(computeDiscount(500, { type: "fixed", value: 1000 })).toBe(500);
    expect(computeDiscount(500, { type: "percent", value: 150 })).toBe(500);
  });
});

describe("input validation", () => {
  it("validates auth inputs", () => {
    expect(loginSchema.safeParse({ email: "not-an-email", password: "x" }).success).toBe(false);
    const weak = registerSchema.safeParse({ displayName: "A", email: "a@b.co", password: "short", confirmPassword: "short", acceptTerms: true });
    expect(weak.success).toBe(false);
    const mismatch = registerSchema.safeParse({ displayName: "A", email: "a@b.co", password: "longenough123", confirmPassword: "different123", acceptTerms: true });
    expect(mismatch.success).toBe(false);
    const ok = registerSchema.safeParse({ displayName: "A", email: "A@B.co", password: "longenough123", confirmPassword: "longenough123", acceptTerms: true });
    expect(ok.success && ok.data.email).toBe("a@b.co");
  });

  it("prevents open redirects", () => {
    expect(safeRedirectPath("/library")).toBe("/library");
    expect(safeRedirectPath("https://evil.test")).toBe("/dashboard");
    expect(safeRedirectPath("//evil.test")).toBe("/dashboard");
    expect(safeRedirectPath("/\\evil.test")).toBe("/dashboard");
  });

  it("drops invalid catalog query parameters", () => {
    const { filters } = parseCatalogParams({ difficulty: "impossible", price: "free", page: "-3", subject: "anatomy'; drop table" });
    expect(filters).toMatchObject({ price: "free" });
    expect(filters.difficulty).toBeUndefined();
    expect(filters.page).toBeUndefined();
    expect(filters.subject).toBeUndefined();
  });

  it("validates admin content metadata and pricing", () => {
    const base = {
      title: "A title", slug: "a-title", description: "A long enough description", subjectId: "10000000-0000-4000-8000-000000000001",
      contentType: "ebook" as const, difficulty: "beginner" as const, isFree: false, price: "149.50", currency: "inr",
      subscriptionEligible: false, learningObjectives: "One\n\nTwo", tags: "A, b, a", pdfDownloadable: true, featured: false,
    };
    const ok = contentMetaSchema.parse(base);
    expect(ok.priceMinor).toBe(14950);
    expect(ok.currency).toBe("INR");
    expect(ok.tags).toEqual(["a", "b"]);
    expect(ok.learningObjectives).toEqual(["One", "Two"]);
    expect(contentMetaSchema.safeParse({ ...base, price: "0" }).success).toBe(false);
    expect(contentMetaSchema.safeParse({ ...base, slug: "Bad Slug!" }).success).toBe(false);
    expect(contentMetaSchema.safeParse({ ...base, contentType: "bundle", isFree: true }).success).toBe(false);
  });

  it("validates coupons", () => {
    expect(couponSchema.parse({ code: "welcome10", discountType: "percent", value: "10" })).toMatchObject({ code: "WELCOME10", discount_value: 10, currency: null });
    expect(couponSchema.safeParse({ code: "X", discountType: "percent", value: "10" }).success).toBe(false);
    expect(couponSchema.safeParse({ code: "BIG", discountType: "percent", value: "101" }).success).toBe(false);
    expect(couponSchema.parse({ code: "FLAT50", discountType: "fixed", value: "50", currency: "inr" })).toMatchObject({ discount_value: 5000, currency: "INR" });
  });
});

describe("roles", () => {
  it("limits permissions by role", () => {
    expect(can(["reviewer"], "content.review")).toBe(true);
    expect(can(["reviewer"], "content.publish")).toBe(false);
    expect(can(["content_editor"], "orders.manage")).toBe(false);
    expect(can(["super_admin"], "settings.manage")).toBe(true);
    expect(can([], "admin.access")).toBe(false);
    expect(isStaff(["student" as never])).toBe(false);
  });
});

describe("file signatures", () => {
  it("detects real image and PDF signatures, not extensions", () => {
    expect(detectImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]))?.mime).toBe("image/png");
    expect(detectImageType(new TextEncoder().encode("<svg onload=alert(1)>  "))).toBeNull();
    expect(isPdf(new TextEncoder().encode("%PDF-1.7 ..."))).toBe(true);
    expect(isPdf(new TextEncoder().encode("MZ executable"))).toBe(false);
  });
});

describe("catalog search (demo mode)", () => {
  it("searches tags and subjects, filters and paginates", () => {
    const r = searchFixtures(fixtureItems, { q: "nernst" }, 1, 12);
    expect(r.items.map((i) => i.slug)).toEqual(["resting-membrane-potential"]);
    expect(searchFixtures(fixtureItems, { price: "free" }, 1, 12).items.every((i) => i.is_free)).toBe(true);
    expect(searchFixtures(fixtureItems, { subject: "anatomy" }, 1, 12).total).toBe(1);
    const page = searchFixtures(fixtureItems, {}, 2, 2);
    expect(page.items).toHaveLength(2);
    expect(page.pageCount).toBe(Math.ceil(fixtureItems.length / 2));
    expect(searchFixtures(fixtureItems, { q: "zzzz-nothing" }, 1, 12).total).toBe(0);
    const priced = searchFixtures(fixtureItems, { sort: "price_asc" }, 1, 12).items.map((i) => i.price_minor_units);
    expect(priced).toEqual([...priced].sort((a, b) => a - b));
  });
});
