import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { getAdminContent, listAdminSubjects, listBundleCandidates } from "@/lib/data/admin";
import { emptyStructuredContent, structuredContentSchema } from "@/lib/content/schema";
import { minorToMajorString } from "@/lib/money";
import { cn } from "@/lib/utils";
import { AdminHeader, Panel, StatusBadge } from "@/components/admin/ui";
import { ContentDetailsForm } from "@/components/admin/content-details-form";
import { BlockEditor } from "@/components/admin/block-editor";
import { CoverPanel, PdfPanel, PublishPanel, VersionHistory } from "@/components/admin/content-panels";
import { NotifyUpdateButton } from "@/components/admin/commerce-forms";
import { Alert } from "@/components/ui/alert";

const TABS = [
  { id: "details", label: "Details" },
  { id: "content", label: "Content" },
  { id: "files", label: "Cover & PDF" },
  { id: "publish", label: "Publishing" },
  { id: "versions", label: "Versions" },
] as const;

export default async function EditContentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; created?: string }> }) {
  const user = await requirePermission("content.read_drafts");
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const item = await getAdminContent(id);
  if (!item) notFound();
  const tab = TABS.some((t) => t.id === sp.tab) ? sp.tab! : "details";
  const canEdit = can(user.roles, "content.edit");
  const isBundle = item.content_type === "bundle";
  const current = item.versions.find((v) => v.id === item.current_version_id) ?? null;
  const parsed = item.current_content ? structuredContentSchema.safeParse(item.current_content) : null;

  const checklist = [
    { label: "Title, description and subject set", ok: Boolean(item.title && item.description.length >= 10), required: true },
    ...(isBundle
      ? [{ label: "Bundle contains at least one title", ok: item.bundle_item_ids.length > 0, required: true }]
      : [
          { label: "Structured content saved", ok: Boolean(item.current_version_id), required: true },
          { label: "Verified PDF for the current version", ok: !item.pdf_downloadable || Boolean(current?.pdf_checked_at), required: item.pdf_downloadable },
          { label: "At least one section marked as free preview", ok: Boolean(parsed?.success && parsed.data.sections.some((s) => s.preview)), required: false },
          { label: "References listed", ok: Boolean(parsed?.success && parsed.data.references.length > 0), required: false },
        ]),
    { label: "Price set (or marked free)", ok: item.is_free || item.price_minor_units > 0, required: true },
    { label: "Educational review recorded", ok: Boolean(item.reviewed_at), required: false },
  ];

  return (
    <>
      <AdminHeader
        title={item.title}
        description={`/${item.slug} · ${item.current_version_number ? `v${item.current_version_number}` : "no content yet"}`}
        actions={
          <>
            <StatusBadge status={item.publication_status} />
            {item.publication_status === "published" ? (
              <Link href={`/notes/${item.slug}`} className="inline-flex items-center gap-1 text-sm text-accent hover:underline" target="_blank">View live <ExternalLink className="size-3.5" /></Link>
            ) : null}
          </>
        }
      />
      {sp.created ? <Alert tone="success" className="mb-4">Draft created. Add structured content next.</Alert> : null}
      <nav aria-label="Editor sections" className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.filter((t) => !(isBundle && (t.id === "content" || t.id === "versions"))).map((t) => (
          <Link
            key={t.id}
            href={`/admin/content/${item.id}?tab=${t.id}`}
            aria-current={tab === t.id ? "page" : undefined}
            className={cn("shrink-0 border-b-2 px-3 py-2 text-sm", tab === t.id ? "border-accent font-medium text-accent" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "details" ? (
        <Panel>
          {canEdit ? (
            <ContentDetailsForm
              mode="edit"
              itemId={item.id}
              subjects={await listAdminSubjects()}
              bundleCandidates={isBundle ? (await listBundleCandidates()).filter((c) => c.id !== item.id) : []}
              defaults={{
                title: item.title,
                slug: item.slug,
                subtitle: item.subtitle ?? "",
                description: item.description,
                subjectId: item.subject_id,
                topicId: item.topic_id ?? "",
                contentType: item.content_type,
                difficulty: item.difficulty,
                isFree: item.is_free,
                price: item.is_free ? "" : minorToMajorString(item.price_minor_units, item.currency),
                currency: item.currency,
                subscriptionEligible: item.subscription_eligible,
                byline: item.byline ?? "",
                learningObjectives: item.learning_objectives.join("\n"),
                tags: item.tags.join(", "),
                pdfDownloadable: item.pdf_downloadable,
                featured: item.featured,
                bundleItemIds: item.bundle_item_ids,
              }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">You can read this item but not edit its details.</p>
          )}
        </Panel>
      ) : null}

      {tab === "content" && !isBundle ? (
        canEdit ? (
          parsed && !parsed.success ? (
            <Alert tone="danger" title="Stored content does not validate">Open the JSON tab of a new draft to repair it, or restore an earlier version.</Alert>
          ) : (
            <BlockEditor itemId={item.id} initial={parsed?.success ? parsed.data : emptyStructuredContent()} />
          )
        ) : (
          <Alert tone="info">Reviewers can read content in the Publishing tab preview link or via the reader; editing requires the content editor role.</Alert>
        )
      ) : null}

      {tab === "files" ? (
        <div className="flex flex-col gap-5">
          <Panel title="Cover image" description="Shown on cards and the product page.">
            {canEdit ? <CoverPanel itemId={item.id} cover={item.cover_image} /> : <p className="text-sm text-muted-foreground">Editors manage covers.</p>}
          </Panel>
          {!isBundle ? (
            <Panel title="Downloadable PDF" description="Stored in a private bucket. Students receive a short-lived signed link after an access check.">
              <PdfPanel
                itemId={item.id}
                hasVersion={Boolean(item.current_version_id) && canEdit}
                downloadable={item.pdf_downloadable}
                current={{ path: current?.pdf_storage_path ?? null, pages: current?.pdf_page_count ?? null, checkedAt: current?.pdf_checked_at ?? null, versionNumber: current?.version_number ?? null }}
              />
            </Panel>
          ) : null}
        </div>
      ) : null}

      {tab === "publish" ? (
        <Panel title="Publishing checklist">
          <PublishPanel
            itemId={item.id}
            status={item.publication_status}
            checklist={checklist}
            canPublish={can(user.roles, "content.publish")}
            canReview={can(user.roles, "content.review")}
            reviewedBy={item.reviewer_name}
          />
        </Panel>
      ) : null}

      {tab === "versions" && !isBundle ? (
        <Panel title="Version history" description="Versions are never overwritten. Restoring creates a new version, and readers always see the latest one. Highlights keep a link to the version they were made on.">
          <VersionHistory itemId={item.id} currentVersionId={item.current_version_id} versions={item.versions} canEdit={canEdit} />
          {item.publication_status === "published" && !item.is_free && can(user.roles, "content.publish") ? (
            <div className="mt-5 border-t border-border pt-4">
              <p className="mb-2 text-sm text-muted-foreground">For important corrections, let owners know a new version is available (they can opt out in their preferences).</p>
              <NotifyUpdateButton itemId={item.id} />
            </div>
          ) : null}
        </Panel>
      ) : null}
    </>
  );
}
