import { requirePermission } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { AdminHeader, Panel, StatusBadge } from "@/components/admin/ui";
import { ModerateButtons } from "@/components/admin/forms";
import { EmptyState } from "@/components/ui/misc";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Reviews" };

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requirePermission("reviews.moderate");
  const sp = await searchParams;
  const status = ["pending", "approved", "rejected", "removed"].includes(sp.status ?? "") ? sp.status! : "pending";
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("reviews")
    .select("id, rating, review_text, moderation_status, created_at, content_items(title), content_reports(id, message)")
    .eq("moderation_status", status)
    .order("created_at", { ascending: true })
    .limit(100);
  const rows = (data ?? []) as unknown as {
    id: string; rating: number; review_text: string | null; moderation_status: string; created_at: string;
    content_items: { title: string } | null; content_reports: { id: string; message: string }[];
  }[];
  return (
    <>
      <AdminHeader title="Review moderation" description="Only approved reviews are public and counted in ratings. Remove abusive content; do not edit reviews." />
      <form className="mb-4 flex gap-2">
        <label htmlFor="status" className="sr-only">Status</label>
        <Select id="status" name="status" defaultValue={status} className="h-9 w-44 text-sm">
          <option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="removed">Removed</option>
        </Select>
        <Button type="submit" variant="secondary" size="sm" className="h-9">Show</Button>
      </form>
      {!rows.length ? <EmptyState title={`No ${status} reviews`} /> : null}
      <div className="flex flex-col gap-3">
        {rows.map((r) => (
          <Panel key={r.id}>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <StatusBadge status={r.moderation_status} />
              <span className="font-medium">{r.content_items?.title}</span>
              <span className="text-muted-foreground">· {r.rating}/5 · {formatDate(r.created_at)}</span>
            </div>
            {r.review_text ? <p className="mt-2 text-[15px] whitespace-pre-wrap">{r.review_text}</p> : <p className="mt-2 text-sm text-muted-foreground">Rating only.</p>}
            {r.content_reports.length ? (
              <div className="mt-2 rounded-md bg-danger-soft p-2 text-xs text-danger">
                Reported {r.content_reports.length}×: {r.content_reports.map((c) => c.message).join(" · ").slice(0, 300)}
              </div>
            ) : null}
            <div className="mt-3"><ModerateButtons id={r.id} status={r.moderation_status} /></div>
          </Panel>
        ))}
      </div>
    </>
  );
}
