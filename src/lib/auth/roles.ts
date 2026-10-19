export const STAFF_ROLES = ["super_admin", "content_editor", "reviewer"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const ROLE_LABELS: Record<StaffRole, string> = {
  super_admin: "Super administrator",
  content_editor: "Content editor",
  reviewer: "Reviewer",
};

export type Permission =
  | "admin.access"
  | "content.read_drafts"
  | "content.edit"
  | "content.publish"
  | "content.review"
  | "categories.manage"
  | "corrections.manage"
  | "reviews.moderate"
  | "orders.manage"
  | "customers.manage"
  | "coupons.manage"
  | "analytics.view"
  | "settings.manage";

const MATRIX: Record<StaffRole, Permission[]> = {
  super_admin: [
    "admin.access",
    "content.read_drafts",
    "content.edit",
    "content.publish",
    "content.review",
    "categories.manage",
    "corrections.manage",
    "reviews.moderate",
    "orders.manage",
    "customers.manage",
    "coupons.manage",
    "analytics.view",
    "settings.manage",
  ],
  content_editor: [
    "admin.access",
    "content.read_drafts",
    "content.edit",
    "content.publish",
    "categories.manage",
    "corrections.manage",
    "reviews.moderate",
  ],
  reviewer: ["admin.access", "content.read_drafts", "content.review", "corrections.manage"],
};

/**
 * UI-level permission check. The database enforces the same rules through
 * RLS and security-definer functions; this mirrors them so the interface
 * only offers actions that will succeed.
 */
export function can(roles: readonly string[], permission: Permission): boolean {
  return roles.some((r) => (MATRIX as Record<string, Permission[]>)[r]?.includes(permission));
}

export function isStaff(roles: readonly string[]): boolean {
  return roles.some((r) => (STAFF_ROLES as readonly string[]).includes(r));
}
