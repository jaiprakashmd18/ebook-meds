import Link from "next/link";
import { requirePermission } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { AdminHeader, Panel, StatusBadge } from "@/components/admin/ui";
import { ReportForm } from "@/components/admin/forms";
import { EmptyState } from "@/components/ui/misc";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Corrections" };

const KIND_LABEL: Record<string, string> = {
  inaccuracy: "Scientific inaccuracy",
  unclear: "Unclear explanation",
  typo: "Typo / formatting",
  feedback: "Feedback",
  review_abuse: "Review report",
  other: "Other",
};

export default async function CorrectionsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requirePermission("corrections.manage");
  const sp = await searchParams;
  const status = ["open", "in_review", "resolved", "rejected"].includes(sp.status ?? "") ? sp.status! : "open";
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("content_reports")
    .select("id, kind, message, section_id, difficulty_rating, status, admin_note, created_at, review_id, content_versions(version_number), content_items(id, title, slug)")
    .eq("status", status)
    .order("created_at", { ascending: true })
    .limit(100);
  const rows = (data ?? []) as unknown as {
    id: string; kind: string; message: string; section_id: string | null; difficulty_rating: number | null; status: string;
    admin_note: string | null; created_at: string; review_id: string | null;
    content_versions: { version_number: number } | null; content_items: { id: string; title: string; slug: string } | null;
  }[];
  return (
    <>
      <AdminHeader title="Corrections and feedback" description="Reports from readers. Fix content by saving a new version, then resolve the report." />
      <form className="mb-4 flex gap-2">
        <label htmlFor="status" className="sr-only">Status</label>
        <Select id="status" name="status" defaultValue={status} className="h-9 w-44 text-sm">
          <option value="open">Open</option><option value="in_review">In review</option><option value="resolved">Resolved</option><option value="rejected">Rejected</option>
        </Select>
        <Button type="submit" variant="secondary" size="sm" className="h-9">Show</Button>
      </form>
      {!rows.length ? <EmptyState title={`No ${status.replace("_", " ")} reports`} /> : null}
      <div className="flex flex-col gap-3">
        {rows.map((r) => (
          <Panel key={r.id}>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <StatusBadge status={r.status} />
              <span className="font-medium">{KIND_LABEL[r.kind] ?? r.kind}</span>
              <span className="text-muted-foreground">·</span>
              {r.content_items ? <Link className="text-accent hover:underline" href={`/admin/content/${r.content_items.id}?tab=content`}>{r.content_items.title}</Link> : null}
              {r.section_id ? <span className="text-muted-foreground">§ {r.section_id}</span> : null}
              {r.content_versions ? <span className="text-muted-foreground">v{r.content_versions.version_number}</span> : null}
              <span className="ml-auto text-xs text-muted-foreground">{formatDate(r.created_at)}</span>
            </div>
            <p className="mt-3 text-[15px] whitespace-pre-wrap">{r.message}</p>
            {r.difficulty_rating ? <p className="mt-1 text-xs text-muted-foreground">Perceived difficulty: {r.difficulty_rating}/5</p> : null}
            {r.review_id ? <p className="mt-1 text-xs"><Link href="/admin/reviews?status=approved" className="text-accent">Open review moderation</Link></p> : null}
            <div className="mt-4"><ReportForm id={r.id} status={r.status} note={r.admin_note} /></div>
          </Panel>
        ))}
      </div>
    </>
  );
}
