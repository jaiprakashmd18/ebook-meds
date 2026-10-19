import Link from "next/link";
import { Plus, Upload } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { listAdminContent } from "@/lib/data/admin";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { CONTENT_TYPE_LABELS } from "@/lib/data/types";
import { AdminHeader, DataTable, StatusBadge } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

export const metadata = { title: "Content" };

export default async function AdminContentPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const user = await requirePermission("content.read_drafts");
  const sp = await searchParams;
  const rows = await listAdminContent({ status: sp.status, q: sp.q?.slice(0, 100) });
  const canEdit = can(user.roles, "content.edit");
  return (
    <>
      <AdminHeader
        title="Content"
        description="Drafts, items in review, published and archived titles."
        actions={
          canEdit ? (
            <>
              <Button asChild variant="outline" size="sm"><Link href="/admin/content/bulk"><Upload /> Bulk PDF upload</Link></Button>
              <Button asChild size="sm"><Link href="/admin/content/new"><Plus /> New item</Link></Button>
            </>
          ) : null
        }
      />
      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <label htmlFor="q" className="sr-only">Search titles</label>
        <Input id="q" name="q" defaultValue={sp.q} placeholder="Search titles" className="h-9 max-w-xs text-sm" />
        <label htmlFor="status" className="sr-only">Status</label>
        <Select id="status" name="status" defaultValue={sp.status ?? ""} className="h-9 w-40 text-sm">
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="review">In review</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </Select>
        <Button type="submit" variant="secondary" size="sm" className="h-9">Filter</Button>
      </form>
      <DataTable head={["Title", "Type", "Status", "Price", "Version", "PDF", "Updated"]} empty={!rows.length}>
        {rows.map((r) => (
          <tr key={r.id} className="hover:bg-surface/60">
            <td className="px-4 py-3">
              <Link href={`/admin/content/${r.id}`} className="font-medium hover:text-accent">{r.title}</Link>
              <p className="text-xs text-muted-foreground">{r.subject?.name}</p>
            </td>
            <td className="px-4 py-3 text-muted-foreground">{CONTENT_TYPE_LABELS[r.content_type]}</td>
            <td className="px-4 py-3"><StatusBadge status={r.publication_status} /></td>
            <td className="px-4 py-3 tabular-nums">{r.is_free ? "Free" : formatMoney(r.price_minor_units, r.currency)}</td>
            <td className="px-4 py-3 tabular-nums">{r.current_version_number ? `v${r.current_version_number}` : "—"}</td>
            <td className="px-4 py-3">{r.pdf_downloadable ? (r.pdf_available ? "Verified" : <span className="text-warning">Missing</span>) : "—"}</td>
            <td className="px-4 py-3 text-muted-foreground">{formatDate(r.updated_at)}</td>
          </tr>
        ))}
      </DataTable>
    </>
  );
}
