"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Loader2, Trash2, Upload, XCircle } from "lucide-react";
import { createDraftForPdf } from "@/server/actions/admin/content";
import { createPdfUploadUrl, verifyUploadedPdf } from "@/server/actions/admin/pdf";
import { uploadWithProgress } from "./content-panels";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { CONTENT_TYPE_LABELS } from "@/lib/data/types";

type Row = {
  key: string;
  file: File;
  title: string;
  description: string;
  subjectId: string;
  contentType: "ebook" | "study_note" | "revision_sheet" | "exam_guide" | "topic_summary" | "question_bank" | "sample_chapter";
  price: string;
  state: "ready" | "creating" | "uploading" | "verifying" | "done" | "error";
  progress: number;
  error?: string;
  itemId?: string;
};

const MAX = 100 * 1024 * 1024;

export function BulkUpload({ subjects }: { subjects: { id: string; name: string }[] }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const patch = (key: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));

  const add = (files: FileList | null) => {
    if (!files) return;
    const next: Row[] = [];
    for (const f of Array.from(files)) {
      const bad = f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf") ? "Not a PDF file." : f.size > MAX ? "Larger than 100 MB." : undefined;
      next.push({
        key: `${f.name}-${f.size}-${Math.random().toString(36).slice(2)}`,
        file: f,
        title: f.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim(),
        description: "",
        subjectId: subjects[0]?.id ?? "",
        contentType: "ebook",
        price: "",
        state: bad ? "error" : "ready",
        progress: 0,
        error: bad,
      });
    }
    setRows((r) => [...r, ...next]);
  };

  const processRow = async (r: Row) => {
    patch(r.key, { state: "creating", error: undefined });
    const created = await createDraftForPdf({ title: r.title, subjectId: r.subjectId, contentType: r.contentType, price: r.price, currency: "INR", description: r.description });
    if (!created.ok || !created.data) return patch(r.key, { state: "error", error: created.ok ? "Failed" : created.error });
    const itemId = created.data.id;
    patch(r.key, { itemId, state: "uploading" });
    const prep = await createPdfUploadUrl(itemId);
    if (!prep.ok || !prep.data) return patch(r.key, { state: "error", error: prep.ok ? "Failed" : prep.error });
    try {
      await uploadWithProgress(prep.data.signedUrl, r.file, (p) => patch(r.key, { progress: p }));
    } catch (e) {
      return patch(r.key, { state: "error", error: e instanceof Error ? e.message : "Upload failed" });
    }
    patch(r.key, { state: "verifying" });
    const verified = await verifyUploadedPdf(itemId, prep.data.path);
    if (!verified.ok) return patch(r.key, { state: "error", error: verified.error });
    patch(r.key, { state: "done", progress: 100 });
  };

  const start = async () => {
    setRunning(true);
    for (const r of rows.filter((x) => x.state === "ready")) {
      // Sequential to keep memory and server load predictable.
      await processRow(r);
    }
    setRunning(false);
  };

  return (
    <div className="flex flex-col gap-5">
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-[var(--radius-lg)] border-2 border-dashed border-border-strong bg-background p-10 text-center hover:bg-surface">
        <Upload className="size-6 text-muted-foreground" aria-hidden />
        <span className="font-medium">Choose PDF files</span>
        <span className="text-sm text-muted-foreground">Up to 100 MB each. Each file becomes a draft for review.</span>
        <input type="file" accept="application/pdf" multiple className="sr-only" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      </label>
      {rows.length ? (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => {
            const locked = r.state !== "ready" && r.state !== "error";
            return (
              <li key={r.key} className="rounded-[var(--radius-md)] border border-border bg-background p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{r.file.name} <span className="font-normal text-muted-foreground">· {(r.file.size / 1048576).toFixed(1)} MB</span></p>
                  {r.state === "ready" || r.state === "error" ? (
                    <Button variant="ghost" size="icon-sm" aria-label={`Remove ${r.file.name}`} onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}><Trash2 /></Button>
                  ) : null}
                </div>
                <fieldset disabled={locked || running} className="mt-3 grid gap-2 md:grid-cols-[2fr_1fr_1fr_120px]">
                  <Input aria-label="Title" value={r.title} onChange={(e) => patch(r.key, { title: e.target.value })} className="h-9 text-sm" />
                  <Select aria-label="Subject" value={r.subjectId} onChange={(e) => patch(r.key, { subjectId: e.target.value })} className="h-9 text-sm">
                    {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Select>
                  <Select aria-label="Content type" value={r.contentType} onChange={(e) => patch(r.key, { contentType: e.target.value as Row["contentType"] })} className="h-9 text-sm">
                    {(["ebook", "study_note", "revision_sheet", "exam_guide", "topic_summary", "question_bank", "sample_chapter"] as const).map((t) => <option key={t} value={t}>{CONTENT_TYPE_LABELS[t]}</option>)}
                  </Select>
                  <Input aria-label="Price in INR (blank = free)" placeholder="Price ₹ (blank = free)" inputMode="decimal" value={r.price} onChange={(e) => patch(r.key, { price: e.target.value })} className="h-9 text-sm" />
                  <Textarea aria-label="Description" placeholder="Short description (10+ characters)" rows={2} value={r.description} onChange={(e) => patch(r.key, { description: e.target.value })} className="text-sm md:col-span-4" />
                </fieldset>
                <div className="mt-2 flex items-center gap-2 text-sm" aria-live="polite">
                  {r.state === "done" ? (
                    <><CheckCircle2 className="size-4 text-success" /> Draft created and PDF verified. <Link href={`/admin/content/${r.itemId}`} className="text-accent hover:underline">Review draft</Link></>
                  ) : r.state === "error" ? (
                    <><XCircle className="size-4 text-danger" /> <span className="text-danger">{r.error}</span></>
                  ) : r.state === "ready" ? (
                    <span className="text-muted-foreground">Ready</span>
                  ) : (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {r.state === "creating" ? "Creating draft…" : r.state === "uploading" ? `Uploading ${r.progress}%` : "Verifying PDF…"}
                      {r.state === "uploading" ? <progress max={100} value={r.progress} className="h-1.5 flex-1" aria-label="Upload progress" /> : null}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
      <div>
        <Button disabled={running || !rows.some((r) => r.state === "ready")} onClick={start}>
          {running ? <Loader2 className="animate-spin" /> : <Upload />} Upload {rows.filter((r) => r.state === "ready").length} file(s) as drafts
        </Button>
      </div>
    </div>
  );
}
