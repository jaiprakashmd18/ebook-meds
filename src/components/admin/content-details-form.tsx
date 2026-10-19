"use client";

import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { contentMetaSchema, type ContentMetaInput } from "@/lib/validation/admin";
import { CONTENT_TYPE_LABELS, CONTENT_TYPES, DIFFICULTIES, DIFFICULTY_LABELS } from "@/lib/data/types";
import { createContentItem, updateContentItem } from "@/server/actions/admin/content";
import type { AdminSubject } from "@/lib/data/admin";
import { slugify } from "@/lib/utils";
import { Field, Input, Select, Textarea, Checkbox } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export function ContentDetailsForm({
  mode,
  itemId,
  defaults,
  subjects,
  bundleCandidates,
}: {
  mode: "create" | "edit";
  itemId?: string;
  defaults: ContentMetaInput;
  subjects: AdminSubject[];
  bundleCandidates: { id: string; title: string; publication_status: string }[];
}) {
  const form = useForm<ContentMetaInput>({
    resolver: zodResolver(contentMetaSchema) as never,
    defaultValues: defaults,
  });
  const { register, watch, setValue, formState } = form;
  const errors = formState.errors as Record<string, { message?: string } | undefined>;
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const [slugTouched, setSlugTouched] = useState(mode === "edit");

  const subjectId = watch("subjectId");
  const isFree = watch("isFree");
  const contentType = watch("contentType");
  const topics = useMemo(() => subjects.find((s) => s.id === subjectId)?.topics ?? [], [subjects, subjectId]);
  const bundleIds = watch("bundleItemIds") ?? [];

  const onSubmit = form.handleSubmit(
    () =>
      start(async () => {
        setResult(null);
        // Send raw input; the server re-validates with the same schema.
        const raw = form.getValues();
        const res = mode === "create" ? await createContentItem(raw) : await updateContentItem(itemId as string, raw);
        if (res && !res.ok) setResult({ ok: false, message: res.error });
        else if (res?.ok) setResult({ ok: true, message: res.message ?? "Saved." });
      }),
    () => setResult({ ok: false, message: "Please fix the highlighted fields." }),
  );

  const err = (name: string) => errors[name]?.message;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Title" htmlFor="title" error={err("title")}>
          <Input
            id="title"
            aria-invalid={Boolean(err("title"))}
            {...register("title", {
              onChange: (e) => {
                if (!slugTouched) setValue("slug", slugify(e.target.value));
              },
            })}
          />
        </Field>
        <Field label="URL slug" htmlFor="slug" error={err("slug")} hint="Appears in /notes/your-slug. Changing it later breaks old links.">
          <Input id="slug" aria-invalid={Boolean(err("slug"))} {...register("slug", { onChange: () => setSlugTouched(true) })} />
        </Field>
      </div>
      <Field label="Subtitle (optional)" htmlFor="subtitle" error={err("subtitle")}>
        <Input id="subtitle" {...register("subtitle")} />
      </Field>
      <Field label="Short description" htmlFor="description" error={err("description")} hint="Shown on cards, product pages and search results.">
        <Textarea id="description" rows={3} aria-invalid={Boolean(err("description"))} {...register("description")} />
      </Field>
      <div className="grid gap-5 md:grid-cols-4">
        <Field label="Subject" htmlFor="subjectId" error={err("subjectId")}>
          <Select id="subjectId" {...register("subjectId", { onChange: () => setValue("topicId", "") })}>
            <option value="">Choose…</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}{s.published ? "" : " (hidden)"}</option>)}
          </Select>
        </Field>
        <Field label="Topic" htmlFor="topicId">
          <Select id="topicId" {...register("topicId")} disabled={!topics.length}>
            <option value="">{topics.length ? "None" : "No topics"}</option>
            {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        </Field>
        <Field label="Content type" htmlFor="contentType">
          <Select id="contentType" {...register("contentType")}>
            {CONTENT_TYPES.map((t) => <option key={t} value={t}>{CONTENT_TYPE_LABELS[t]}</option>)}
          </Select>
        </Field>
        <Field label="Difficulty" htmlFor="difficulty">
          <Select id="difficulty" {...register("difficulty")}>
            {DIFFICULTIES.map((d) => <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}
          </Select>
        </Field>
      </div>

      <fieldset className="grid gap-5 rounded-[var(--radius-md)] border border-border p-4 md:grid-cols-4">
        <legend className="px-1 text-sm font-medium">Pricing</legend>
        <label className="flex items-center gap-2 self-end pb-3 text-sm">
          <Checkbox {...register("isFree")} disabled={contentType === "bundle"} /> Free to read
        </label>
        <Field label="Price" htmlFor="price" error={err("price")} hint="In major units, e.g. 149">
          <Input id="price" inputMode="decimal" disabled={isFree} aria-invalid={Boolean(err("price"))} {...register("price")} />
        </Field>
        <Field label="Currency" htmlFor="currency" error={err("currency")}>
          <Input id="currency" maxLength={3} {...register("currency")} />
        </Field>
        <label className="flex items-center gap-2 self-end pb-3 text-sm">
          <Checkbox {...register("subscriptionEligible")} disabled={isFree || contentType === "bundle"} /> Included in subscription
        </label>
      </fieldset>

      {contentType === "bundle" ? (
        <fieldset className="rounded-[var(--radius-md)] border border-border p-4">
          <legend className="px-1 text-sm font-medium">Titles in this bundle</legend>
          {!bundleCandidates.length ? <p className="text-sm text-muted-foreground">Create paid titles first.</p> : null}
          <div className="grid gap-2 sm:grid-cols-2">
            {bundleCandidates.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={bundleIds.includes(c.id)}
                  onChange={(e) =>
                    setValue(
                      "bundleItemIds",
                      e.target.checked ? [...bundleIds, c.id] : bundleIds.filter((x) => x !== c.id),
                      { shouldDirty: true },
                    )
                  }
                />
                {c.title} {c.publication_status !== "published" ? <span className="text-xs text-muted-foreground">({c.publication_status})</span> : null}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Learning objectives" htmlFor="learningObjectives" hint="One per line." error={err("learningObjectives")}>
          <Textarea id="learningObjectives" rows={5} {...register("learningObjectives")} />
        </Field>
        <div className="flex flex-col gap-5">
          <Field label="Tags" htmlFor="tags" hint="Comma separated, e.g. glycolysis, metabolism" error={err("tags")}>
            <Input id="tags" {...register("tags")} />
          </Field>
          <Field label="Author byline" htmlFor="byline" hint="Shown publicly. Only name people who agreed to it.">
            <Input id="byline" {...register("byline")} />
          </Field>
        </div>
      </div>
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox {...register("pdfDownloadable")} disabled={contentType === "bundle"} /> Offer a PDF download
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox {...register("featured")} /> Feature on the homepage
        </label>
      </div>
      {result ? <Alert tone={result.ok ? "success" : "danger"}>{result.message}</Alert> : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          {mode === "create" ? "Create draft" : "Save details"}
        </Button>
      </div>
    </form>
  );
}
