"use client";

import { useActionState, useTransition, useState } from "react";
import { Trash2 } from "lucide-react";
import { addTopic, deleteSubject, deleteTopic, moderateReview, saveSubject, updateReport } from "@/server/actions/admin/catalog";
import { initialActionState, type ActionResult } from "@/server/actions/types";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Checkbox, Input, Label, Select, Textarea } from "@/components/ui/input";
import { slugify } from "@/lib/utils";

function Result({ state }: { state: ActionResult }) {
  if (!state.ok) return <Alert tone="danger">{state.error}</Alert>;
  if (state.message) return <Alert tone="success">{state.message}</Alert>;
  return null;
}

export function SubjectForm({ subject }: { subject?: { id: string; name: string; slug: string; description: string; published: boolean; sort_order: number } }) {
  const [state, action] = useActionState(saveSubject, initialActionState);
  const [slug, setSlug] = useState(subject?.slug ?? "");
  return (
    <form action={action} className="flex flex-col gap-3">
      {subject ? <input type="hidden" name="id" value={subject.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_100px]">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`name-${subject?.id ?? "new"}`} className="text-xs">Name</Label>
          <Input id={`name-${subject?.id ?? "new"}`} name="name" defaultValue={subject?.name} required className="h-9 text-sm" onChange={(e) => !subject && setSlug(slugify(e.target.value))} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`slug-${subject?.id ?? "new"}`} className="text-xs">Slug</Label>
          <Input id={`slug-${subject?.id ?? "new"}`} name="slug" value={slug} onChange={(e) => setSlug(e.target.value)} required className="h-9 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`order-${subject?.id ?? "new"}`} className="text-xs">Order</Label>
          <Input id={`order-${subject?.id ?? "new"}`} name="sortOrder" type="number" min={0} defaultValue={subject?.sort_order ?? 0} className="h-9 text-sm" />
        </div>
      </div>
      <Textarea name="description" aria-label="Description" defaultValue={subject?.description} rows={2} placeholder="Short introduction shown on the subject page" className="text-sm" />
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm"><Checkbox name="published" defaultChecked={subject?.published ?? false} /> Visible to students</label>
        <SubmitButton size="sm" pendingLabel="Saving…">{subject ? "Save" : "Create subject"}</SubmitButton>
      </div>
      <Result state={state} />
    </form>
  );
}

export function TopicForm({ subjectId }: { subjectId: string }) {
  const [state, action] = useActionState(addTopic, initialActionState);
  const [slug, setSlug] = useState("");
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="subjectId" value={subjectId} />
      <div className="flex gap-2">
        <Input name="name" aria-label="Topic name" placeholder="New topic" required className="h-8 text-sm" onChange={(e) => setSlug(slugify(e.target.value))} />
        <Input name="slug" aria-label="Topic slug" value={slug} onChange={(e) => setSlug(e.target.value)} required className="h-8 text-sm" />
        <SubmitButton size="sm" variant="secondary">Add</SubmitButton>
      </div>
      <Result state={state} />
    </form>
  );
}

export function DeleteButton({ kind, id, label }: { kind: "subject" | "topic"; id: string; label: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Delete ${label}`}
        disabled={pending}
        onClick={() => {
          if (!confirm(`Delete ${label}?`)) return;
          start(async () => {
            const res = kind === "subject" ? await deleteSubject(id) : await deleteTopic(id);
            setMsg(res.ok ? null : res.error);
          });
        }}
      >
        <Trash2 />
      </Button>
      {msg ? <span className="text-xs text-danger">{msg}</span> : null}
    </span>
  );
}

export function ReportForm({ id, status, note }: { id: string; status: string; note: string | null }) {
  const [state, action] = useActionState(updateReport, initialActionState);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select name="status" defaultValue={status} aria-label="Status" className="h-9 text-sm sm:w-40">
          <option value="open">Open</option>
          <option value="in_review">In review</option>
          <option value="resolved">Resolved</option>
          <option value="rejected">Rejected</option>
        </Select>
        <Input name="note" defaultValue={note ?? ""} aria-label="Internal note" placeholder="Internal note (e.g. fixed in v3)" className="h-9 flex-1 text-sm" />
        <SubmitButton size="sm" variant="secondary">Update</SubmitButton>
      </div>
      <Result state={state} />
    </form>
  );
}

export function ModerateButtons({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const act = (s: "approved" | "rejected" | "removed") =>
    start(async () => {
      const res = await moderateReview(id, s);
      setMsg(res.ok ? res.message ?? null : res.error);
    });
  return (
    <div className="flex flex-wrap items-center gap-2">
      {status !== "approved" ? <Button size="sm" disabled={pending} onClick={() => act("approved")}>Approve</Button> : null}
      {status === "pending" ? <Button size="sm" variant="outline" disabled={pending} onClick={() => act("rejected")}>Reject</Button> : null}
      {status !== "removed" ? <Button size="sm" variant="ghost" disabled={pending} onClick={() => act("removed")}>Remove</Button> : null}
      {msg ? <span className="text-xs text-muted-foreground">{msg}</span> : null}
    </div>
  );
}
