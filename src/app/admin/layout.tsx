import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/auth/session";
import { can, ROLE_LABELS } from "@/lib/auth/roles";
import { isDemoMode } from "@/lib/env";
import { Logo } from "@/components/site/logo";
import { Container } from "@/components/ui/misc";
import { Alert } from "@/components/ui/alert";
import { AdminNav } from "@/components/admin/nav";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (isDemoMode()) {
    return (
      <Container className="py-20">
        <Alert tone="warning" title="Admin tools need Supabase">
          The admin workspace manages real database records, so it is disabled in demo mode. Configure Supabase (see
          README) and grant your account a role.
        </Alert>
      </Container>
    );
  }
  const user = await requirePermission("admin.access");
  const items = [
    { href: "/admin", label: "Overview", show: true },
    { href: "/admin/content", label: "Content", show: can(user.roles, "content.read_drafts") },
    { href: "/admin/categories", label: "Categories", show: can(user.roles, "categories.manage") },
    { href: "/admin/corrections", label: "Corrections", show: can(user.roles, "corrections.manage") },
    { href: "/admin/reviews", label: "Reviews", show: can(user.roles, "reviews.moderate") },
    { href: "/admin/orders", label: "Orders", show: can(user.roles, "orders.manage") },
    { href: "/admin/customers", label: "Customers", show: can(user.roles, "customers.manage") },
    { href: "/admin/coupons", label: "Coupons", show: can(user.roles, "coupons.manage") },
    { href: "/admin/analytics", label: "Analytics", show: can(user.roles, "analytics.view") },
    { href: "/admin/settings", label: "Settings", show: can(user.roles, "settings.manage") },
  ].filter((i) => i.show);

  return (
    <div className="flex min-h-dvh flex-col bg-surface lg:flex-row">
      <aside className="border-b border-border bg-background lg:sticky lg:top-0 lg:h-dvh lg:w-60 lg:shrink-0 lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between px-5 py-4">
          <Logo />
        </div>
        <AdminNav items={items.map(({ href, label }) => ({ href, label }))} />
        <div className="hidden px-5 py-4 text-xs text-muted-foreground lg:block">
          <p className="truncate font-medium text-foreground">{user.displayName ?? user.email}</p>
          <p>{user.roles.map((r) => ROLE_LABELS[r]).join(", ")}</p>
          <Link href="/" className="mt-2 inline-block text-accent hover:underline">View site</Link>
        </div>
      </aside>
      <main id="main" className="min-w-0 flex-1 px-4 py-8 sm:px-8">{children}</main>
    </div>
  );
}
