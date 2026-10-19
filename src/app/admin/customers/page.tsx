import { requirePermission } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/utils";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { GrantForm, RevokeGrantButton, RoleToggle } from "@/components/admin/commerce-forms";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; user?: string; page?: string }> }) {
  const actor = await requirePermission("customers.manage");
  if (!isAdminClientConfigured()) return <Alert tone="warning">SUPABASE_SECRET_KEY is required to list accounts.</Alert>;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const admin = createSupabaseAdminClient();
  // Listing accounts needs the Auth admin API; access is restricted to super admins above.
  const { data: list } = await admin.auth.admin.listUsers({ page, perPage: 50 });
  let users = list?.users ?? [];
  if (sp.user) users = users.filter((u) => u.id === sp.user);
  if (sp.q) users = users.filter((u) => (u.email ?? "").toLowerCase().includes(sp.q!.toLowerCase()));
  const ids = users.map((u) => u.id);
  const supabase = await createSupabaseServerClient();
  const none = ["00000000-0000-0000-0000-000000000000"];
  const [{ data: roles }, { data: purchases }, { data: grants }, { data: items }] = await Promise.all([
    supabase.from("user_roles").select("user_id, role").in("user_id", ids.length ? ids : none),
    supabase.from("purchases").select("user_id, access_status").in("user_id", ids.length ? ids : none),
    supabase.from("access_grants").select("id, user_id, reason, expires_at, revoked_at, content_items(title)").in("user_id", ids.length ? ids : none).is("revoked_at", null),
    supabase.from("content_items").select("id, title").eq("is_free", false).neq("content_type", "bundle").order("title"),
  ]);
  return (
    <>
      <AdminHeader title="Customers" description="Accounts, roles and manual access grants. Every change is written to the audit log." />
      <form className="mb-4 flex gap-2">
        <label htmlFor="q" className="sr-only">Search email</label>
        <Input id="q" name="q" defaultValue={sp.q} placeholder="Filter this page by email" className="h-9 max-w-xs text-sm" />
        <Button type="submit" size="sm" variant="secondary" className="h-9">Filter</Button>
      </form>
      <div className="flex flex-col gap-3">
        {users.map((u) => {
          const userRoles = new Set((roles ?? []).filter((r) => r.user_id === u.id).map((r) => r.role as string));
          const owned = (purchases ?? []).filter((p) => p.user_id === u.id && p.access_status === "active").length;
          const userGrants = (grants ?? []).filter((g) => g.user_id === u.id) as unknown as { id: string; reason: string; expires_at: string | null; content_items: { title: string } | null }[];
          return (
            <Panel key={u.id}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{u.email}</p>
                  <p className="text-xs text-muted-foreground">Joined {formatDate(u.created_at)} · {u.email_confirmed_at ? "verified" : "unverified"} · {owned} active purchase(s)</p>
                </div>
                <div className="flex flex-wrap gap-4">
                  <RoleToggle userId={u.id} role="content_editor" has={userRoles.has("content_editor")} label="Editor" />
                  <RoleToggle userId={u.id} role="reviewer" has={userRoles.has("reviewer")} label="Reviewer" />
                  <RoleToggle userId={u.id} role="super_admin" has={userRoles.has("super_admin")} label={u.id === actor.id ? "Super admin (you)" : "Super admin"} />
                </div>
              </div>
              {userGrants.length ? (
                <ul className="mt-3 flex flex-col gap-1 text-sm">
                  {userGrants.map((g) => <li key={g.id} className="flex items-center gap-2">Granted: {g.content_items?.title} — {g.reason}{g.expires_at ? ` (until ${formatDate(g.expires_at)})` : ""} <RevokeGrantButton id={g.id} /></li>)}
                </ul>
              ) : null}
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-accent">Grant access to a title</summary>
                <div className="mt-2"><GrantForm userId={u.id} items={(items ?? []) as { id: string; title: string }[]} /></div>
              </details>
            </Panel>
          );
        })}
      </div>
      <div className="mt-6 flex justify-between text-sm">
        {page > 1 ? <a className="text-accent" href={`/admin/customers?page=${page - 1}`}>← Previous</a> : <span />}
        {(list?.users.length ?? 0) === 50 ? <a className="text-accent" href={`/admin/customers?page=${page + 1}`}>Next →</a> : null}
      </div>
    </>
  );
}
