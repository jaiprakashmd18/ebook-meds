"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { CheckCircle2, Circle, FileDown, FileUp, Loader2, RotateCcw, Sparkles, Upload, XCircle } from "lucide-react";
import { markReviewed, removeCover, restoreVersion, setContentStatus, uploadCover } from "@/server/actions/admin/content";
import { createPdfUploadUrl, generatePdf, getStaffPdfLink, verifyUploadedPdf } from "@/server/actions/admin/pdf";
import type { ActionResult } from "@/server/actions/types";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Input, Label } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";

function useAction() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const run = (fn: () => Promise<ActionResult<unknown>>) =>
    start(async () => {
      setResult(null);
      const res = await fn();
      setResult(res.ok ? { ok: true, message: res.message ?? "Done." } : { ok: false, message: res.error });
    });
  return { pending, result, run, setResult };
}

export function PublishPanel({
  itemId,
  status,
  checklist,
  canPublish,
  canReview,
  reviewedBy,
}: {
  itemId: string;
  status: string;
  checklist: { label: string; ok: boolean; required: boolean }[];
  canPublish: boolean;
  canReview: boolean;
  reviewedBy: string | null;
}) {
  const { pending, result, run } = useAction();
  const [reviewer, setReviewer] = useState("");
  const blockers = checklist.filter((c) => c.required && !c.ok);
  return (
    <div className="flex flex-col gap-5">
      <ul className="flex flex-col gap-2">
        {checklist.map((c) => (
          <li key={c.label} className="flex items-start gap-2 text-sm">
            {c.ok ? <CheckCircle2 className="mt-0.5 size-4 text-success" aria-label="Done" /> : c.required ? <XCircle className="mt-0.5 size-4 text-danger" aria-label="Required" /> : <Circle className="mt-0.5 size-4 text-muted-foreground" aria-label="Recommended" />}
            <span>{c.label}{!c.required ? <span className="text-muted-foreground"> (recommended)</span> : null}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        {status !== "review" && status !== "published" ? (
          <Button variant="outline" disabled={pending} onClick={() => run(() => setContentStatus(itemId, "review"))}>Submit for review</Button>
        ) : null}
        {canPublish && status !== "published" ? (
          <Button disabled={pending || blockers.length > 0} onClick={() => run(() => setContentStatus(itemId, "published"))}>
            {pending ? <Loader2 className="animate-spin" /> : null} Publish
          </Button>
        ) : null}
        {canPublish && status === "published" ? (
          <Button variant="outline" disabled={pending} onClick={() => run(() => setContentStatus(itemId, "draft"))}>Unpublish (back to draft)</Button>
        ) : null}
        {canPublish && status !== "archived" ? (
          <Button variant="ghost" disabled={pending} onClick={() => { if (confirm("Archive this item? It will disappear from the catalogue but purchasers keep access to their library entry only while it is published.")) run(() => setContentStatus(itemId, "archived")); }}>Archive</Button>
        ) : null}
        {status !== "draft" && status !== "published" ? (
          <Button variant="ghost" disabled={pending} onClick={() => run(() => setContentStatus(itemId, "draft"))}>Return to draft</Button>
        ) : null}
      </div>
      {blockers.length && canPublish && status !== "published" ? <p className="text-xs text-muted-foreground">Complete the required items to enable publishing. Uploaded files are never published automatically.</p> : null}

      {canReview ? (
        <div className="rounded-[var(--radius-md)] border border-border p-4">
          <p className="text-sm font-medium">Educational review</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {reviewedBy ? `Currently shown as reviewed by ${reviewedBy}.` : "Not yet reviewed."} Only record a review you actually carried out; your name is shown publicly.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <label htmlFor="reviewer" className="sr-only">Reviewer name as shown publicly</label>
            <Input id="reviewer" value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="e.g. Dr A. Sharma, MD (Physiology)" className="h-9 text-sm" />
            <Button size="sm" variant="secondary" disabled={pending || reviewer.trim().length < 2} onClick={() => run(() => markReviewed(itemId, reviewer))}>Mark as reviewed</Button>
          </div>
        </div>
      ) : null}
      {result ? <Alert tone={result.ok ? "success" : "danger"}>{result.message}</Alert> : null}
    </div>
  );
}

export function VersionHistory({
  itemId,
  currentVersionId,
  versions,
  canEdit,
}: {
  itemId: string;
  currentVersionId: string | null;
  versions: { id: string; version_number: number; change_summary: string | null; created_at: string; pdf_storage_path: string | null; pdf_page_count: number | null; pdf_checked_at: string | null }[];
  canEdit: boolean;
}) {
  const { pending, result, run } = useAction();
  if (!versions.length) return <p className="text-sm text-muted-foreground">No versions yet. Save content to create version 1.</p>;
  return (
    <div className="flex flex-col gap-3">
      <ol className="divide-y divide-border rounded-[var(--radius-md)] border border-border">
        {versions.map((v) => (
          <li key={v.id} className="flex flex-col gap-1 p-3 text-sm sm:flex-row sm:items-center sm:gap-4">
            <span className="w-12 font-medium tabular-nums">v{v.version_number}</span>
            <span className="flex-1">
              {v.change_summary ?? <span className="text-muted-foreground">No summary</span>}
              <span className="block text-xs text-muted-foreground">
                {formatDate(v.created_at, { dateStyle: "medium", timeStyle: "short" })}
                {v.pdf_checked_at ? ` · PDF ${v.pdf_page_count} pages` : ""}
              </span>
            </span>
            {v.id === currentVersionId ? (
              <span className="text-xs font-medium text-success">Current</span>
            ) : canEdit ? (
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => { if (confirm(`Restore version ${v.version_number}? This creates a new version with its content.`)) run(() => restoreVersion(itemId, v.id)); }}>
                <RotateCcw /> Restore
              </Button>
            ) : null}
          </li>
        ))}
      </ol>
      {result ? <Alert tone={result.ok ? "success" : "danger"}>{result.message}</Alert> : null}
    </div>
  );
}

export function CoverPanel({ itemId, cover }: { itemId: string; cover: string | null }) {
  const { pending, result, run } = useAction();
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-6">
      <div className="relative aspect-[3/4] w-32 overflow-hidden rounded-[var(--radius-sm)] border border-border bg-surface">
        {cover ? <Image src={cover} alt="Current cover" fill sizes="128px" className="object-cover" /> : <p className="p-3 text-xs text-muted-foreground">Typographic cover is used.</p>}
      </div>
      <div className="flex flex-col gap-2">
        <input
          ref={ref}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const fd = new FormData();
            fd.set("cover", f);
            run(() => uploadCover(itemId, fd));
            e.target.value = "";
          }}
        />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={pending} onClick={() => ref.current?.click()}>
            {pending ? <Loader2 className="animate-spin" /> : <Upload />} Upload cover
          </Button>
          {cover ? <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => removeCover(itemId))}>Remove</Button> : null}
        </div>
        <p className="text-xs text-muted-foreground">JPEG, PNG, WebP or AVIF, up to 5 MB, ideally 3:4 (e.g. 1200×1600).</p>
        {result ? <Alert tone={result.ok ? "success" : "danger"}>{result.message}</Alert> : null}
      </div>
    </div>
  );
}

/** PUT a file to a Supabase signed upload URL with progress reporting. */
export function uploadWithProgress(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", "application/pdf");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
}

export function PdfPanel({
  itemId,
  hasVersion,
  current,
  downloadable,
}: {
  itemId: string;
  hasVersion: boolean;
  current: { path: string | null; pages: number | null; checkedAt: string | null; versionNumber: number | null };
  downloadable: boolean;
}) {
  const { pending, result, run, setResult } = useAction();
  const [progress, setProgress] = useState<number | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setResult(null);
    if (file.type && file.type !== "application/pdf") return setResult({ ok: false, message: "Choose a PDF file." });
    if (file.size > 100 * 1024 * 1024) return setResult({ ok: false, message: "PDFs must be 100 MB or smaller." });
    const prep = await createPdfUploadUrl(itemId);
    if (!prep.ok || !prep.data) return setResult({ ok: false, message: prep.ok ? "Could not prepare upload." : prep.error });
    try {
      setProgress(0);
      await uploadWithProgress(prep.data.signedUrl, file, setProgress);
    } catch (e) {
      setProgress(null);
      return setResult({ ok: false, message: e instanceof Error ? e.message : "Upload failed." });
    }
    setProgress(null);
    run(() => verifyUploadedPdf(itemId, prep.data!.path));
  };

  return (
    <div className="flex flex-col gap-4">
      {!downloadable ? <Alert tone="info">PDF downloads are switched off for this item (Details → “Offer a PDF download”).</Alert> : null}
      <div className="rounded-[var(--radius-md)] border border-border p-4 text-sm">
        {current.checkedAt && current.path ? (
          <p className="flex flex-wrap items-center gap-2">
            <CheckCircle2 className="size-4 text-success" /> Verified PDF for v{current.versionNumber}: {current.pages} pages, checked {formatDate(current.checkedAt, { dateStyle: "medium", timeStyle: "short" })}.
            <button
              className="text-accent hover:underline"
              onClick={async () => {
                const res = await getStaffPdfLink(itemId, current.path!);
                if (res.ok && res.data) window.open(res.data.url, "_blank", "noopener");
              }}
            >
              <FileDown className="mr-0.5 inline size-3.5" />Open
            </button>
          </p>
        ) : (
          <p className="text-muted-foreground">No verified PDF for the current version.</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={!hasVersion || pending || progress !== null} onClick={() => run(() => generatePdf(itemId))}>
          {pending ? <Loader2 className="animate-spin" /> : <Sparkles />} Generate branded PDF
        </Button>
        <input ref={ref} type="file" accept="application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
        <Button variant="outline" disabled={!hasVersion || pending || progress !== null} onClick={() => ref.current?.click()}>
          <FileUp /> Upload PDF instead
        </Button>
      </div>
      {progress !== null ? (
        <div>
          <Label className="text-xs">Uploading… {progress}%</Label>
          <progress max={100} value={progress} className="mt-1 h-2 w-full overflow-hidden rounded accent-[var(--accent)]" aria-label="Upload progress" />
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Each PDF is checked (file signature, size, readable, has pages) and tied to the current content version. Saving a new version requires a new PDF.
      </p>
      {result ? <Alert tone={result.ok ? "success" : "danger"}>{result.message}</Alert> : null}
    </div>
  );
}
