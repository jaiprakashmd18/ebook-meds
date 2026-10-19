"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertPermission, AuthorizationError } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { estimateReadingMinutes, structuredContentSchema } from "@/lib/content/schema";
import { contentMetaSchema, type ContentMetaInput } from "@/lib/validation/admin";
import { detectImageType } from "@/lib/files";
import { parseMajorToMinor } from "@/lib/money";
import { slugify } from "@/lib/utils";
import type { ActionResult } from "../types";

function fail(e: unknown, fallback: string): ActionResult<never> {
  if (e instanceof AuthorizationError) return { ok: false, error: e.message };
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Invalid input" };
  console.error("[admin content]", e instanceof Error ? e.message : e);
  return { ok: false, error: fallback };
}

function dbError(message: string | undefined): string {
  if (!message) return "The database rejected the change.";
  if (message.includes("content_items_slug_key")) return "That URL slug is already used by another title.";
  if (message.includes("content_price_matches_free")) return "Free items must have a price of 0; paid items need a price above 0.";
  if (message.includes("row-level security") || message.includes("forbidden")) return "You do not have permission to do that.";
  // Messages raised deliberately by our SQL functions are safe to show.
  if (/publishing|bundle needs|verified PDF|add content/.test(message)) return message;
  return "The database rejected the change.";
}

async function syncTagsAndBundle(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  id: string,
  tags: string[],
  bundleItemIds: string[] | undefined,
) {
  await supabase.from("content_tags").delete().eq("content_item_id", id);
  if (tags.length) {
    const { error } = await supabase.from("content_tags").insert(tags.map((tag) => ({ content_item_id: id, tag })));
    if (error) throw new Error(error.message);
  }
  if (bundleItemIds) {
    await supabase.from("bundle_items").delete().eq("bundle_id", id);
    if (bundleItemIds.length) {
      const { error } = await supabase
        .from("bundle_items")
        .insert(bundleItemIds.map((child, i) => ({ bundle_id: id, content_item_id: child, sort_order: i })));
      if (error) throw new Error(error.message);
    }
  }
}

function toRow(m: z.output<typeof contentMetaSchema>) {
  return {
    title: m.title,
    slug: m.slug,
    subtitle: m.subtitle || null,
    description: m.description,
    subject_id: m.subjectId,
    topic_id: m.topicId || null,
    content_type: m.contentType,
    difficulty: m.difficulty,
    price_minor_units: m.isFree ? 0 : m.priceMinor,
    currency: m.currency,
    is_free: m.isFree,
    subscription_eligible: m.isFree ? false : m.subscriptionEligible,
    byline: m.byline || null,
    learning_objectives: m.learningObjectives,
    pdf_downloadable: m.contentType === "bundle" ? false : m.pdfDownloadable,
    featured: m.featured,
  };
}

export async function createContentItem(input: ContentMetaInput): Promise<ActionResult<{ id: string }>> {
  let id: string;
  try {
    const user = await assertPermission("content.edit");
    const meta = contentMetaSchema.parse(input);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("content_items")
      .insert({ ...toRow(meta), author_id: user.id })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: dbError(error?.message) };
    id = data.id as string;
    await syncTagsAndBundle(supabase, id, meta.tags, meta.contentType === "bundle" ? meta.bundleItemIds : undefined);
    await supabase.rpc("log_audit_event", { p_action: "content.created", p_resource_type: "content_item", p_resource_id: id, p_metadata: { title: meta.title } });
  } catch (e) {
    return fail(e, "Could not create the item.");
  }
  redirect(`/admin/content/${id}?created=1`);
}

export async function updateContentItem(id: string, input: ContentMetaInput): Promise<ActionResult> {
  try {
    await assertPermission("content.edit");
    const itemId = z.uuid().parse(id);
    const meta = contentMetaSchema.parse(input);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("content_items").update(toRow(meta)).eq("id", itemId);
    if (error) return { ok: false, error: dbError(error.message) };
    await syncTagsAndBundle(supabase, itemId, meta.tags, meta.contentType === "bundle" ? meta.bundleItemIds : undefined);
    await supabase.rpc("log_audit_event", { p_action: "content.updated", p_resource_type: "content_item", p_resource_id: itemId, p_metadata: {} });
    revalidatePath(`/admin/content/${itemId}`);
    revalidatePath(`/notes/${meta.slug}`);
    return { ok: true, message: "Details saved." };
  } catch (e) {
    return fail(e, "Could not save the details.");
  }
}

const versionInput = z.object({ id: z.uuid(), content: z.unknown(), summary: z.string().trim().max(1000).optional() });

export async function saveContentVersion(input: z.input<typeof versionInput>): Promise<ActionResult<{ versionNumber: number }>> {
  try {
    await assertPermission("content.edit");
    const { id, content, summary } = versionInput.parse(input);
    const parsed = structuredContentSchema.safeParse(content);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return { ok: false, error: `Content is invalid at ${issue.path.join(" › ")}: ${issue.message}` };
    }
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("create_content_version", {
      p_item: id,
      p_content: parsed.data,
      p_change_summary: summary || null,
      p_reading_minutes: estimateReadingMinutes(parsed.data),
    });
    if (error) return { ok: false, error: dbError(error.message) };
    revalidatePath(`/admin/content/${id}`);
    const versionNumber = (data as { version_number: number }).version_number;
    return { ok: true, message: `Saved as version ${versionNumber}.`, data: { versionNumber } };
  } catch (e) {
    return fail(e, "Could not save the content.");
  }
}

export async function restoreVersion(itemId: string, versionId: string): Promise<ActionResult> {
  try {
    await assertPermission("content.edit");
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("restore_content_version", { p_version: z.uuid().parse(versionId) });
    if (error) return { ok: false, error: dbError(error.message) };
    revalidatePath(`/admin/content/${itemId}`);
    return { ok: true, message: "Restored as a new version." };
  } catch (e) {
    return fail(e, "Could not restore that version.");
  }
}

const STATUSES = ["draft", "review", "published", "archived"] as const;

export async function setContentStatus(id: string, status: (typeof STATUSES)[number]): Promise<ActionResult> {
  try {
    await assertPermission(status === "published" || status === "archived" ? "content.publish" : "content.read_drafts");
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .rpc("set_publication_status", { p_item: z.uuid().parse(id), p_status: z.enum(STATUSES).parse(status) })
      .single();
    if (error) return { ok: false, error: dbError(error.message) };
    revalidatePath(`/admin/content/${id}`);
    revalidatePath("/", "layout");
    const slug = (data as { slug: string }).slug;
    revalidatePath(`/notes/${slug}`);
    return { ok: true, message: `Status changed to ${status}.` };
  } catch (e) {
    return fail(e, "Could not change the status.");
  }
}

export async function markReviewed(id: string, reviewerName: string): Promise<ActionResult> {
  try {
    await assertPermission("content.review");
    const name = z.string().trim().min(2, "Enter the reviewer's name as it should appear publicly").max(200).parse(reviewerName);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("mark_content_reviewed", { p_item: z.uuid().parse(id), p_reviewer_name: name });
    if (error) return { ok: false, error: dbError(error.message) };
    revalidatePath(`/admin/content/${id}`);
    return { ok: true, message: "Recorded your review." };
  } catch (e) {
    return fail(e, "Could not record the review.");
  }
}

const MAX_COVER_BYTES = 5 * 1024 * 1024;

export async function uploadCover(id: string, formData: FormData): Promise<ActionResult> {
  try {
    await assertPermission("content.edit");
    const itemId = z.uuid().parse(id);
    const file = formData.get("cover");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose an image file." };
    if (file.size > MAX_COVER_BYTES) return { ok: false, error: "Cover images must be 5 MB or smaller." };
    const bytes = new Uint8Array(await file.arrayBuffer());
    // Check the actual file signature, not the browser-supplied type.
    const type = detectImageType(bytes);
    if (!type) return { ok: false, error: "Use a JPEG, PNG, WebP or AVIF image." };
    const supabase = await createSupabaseServerClient();
    const path = `${itemId}/${Date.now()}.${type.ext}`;
    const { error } = await supabase.storage.from("covers").upload(path, bytes, { contentType: type.mime, upsert: false });
    if (error) return { ok: false, error: "Upload failed. Check the file and try again." };
    const { data: pub } = supabase.storage.from("covers").getPublicUrl(path);
    const { error: upd } = await supabase.from("content_items").update({ cover_image: pub.publicUrl }).eq("id", itemId);
    if (upd) return { ok: false, error: dbError(upd.message) };
    revalidatePath(`/admin/content/${itemId}`);
    return { ok: true, message: "Cover updated." };
  } catch (e) {
    return fail(e, "Could not upload the cover.");
  }
}

export async function removeCover(id: string): Promise<ActionResult> {
  try {
    await assertPermission("content.edit");
    const supabase = await createSupabaseServerClient();
    await supabase.from("content_items").update({ cover_image: null }).eq("id", z.uuid().parse(id));
    revalidatePath(`/admin/content/${id}`);
    return { ok: true, message: "Cover removed. A typographic cover will be shown." };
  } catch (e) {
    return fail(e, "Could not remove the cover.");
  }
}

/** Upload an image for use inside note content (content-images bucket). */
export async function uploadContentImage(formData: FormData): Promise<ActionResult<{ src: string }>> {
  try {
    await assertPermission("content.edit");
    const file = formData.get("image");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose an image file." };
    if (file.size > MAX_COVER_BYTES) return { ok: false, error: "Images must be 5 MB or smaller." };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = detectImageType(bytes);
    if (!type) return { ok: false, error: "Use a JPEG, PNG, WebP or AVIF image." };
    const supabase = await createSupabaseServerClient();
    const path = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${type.ext}`;
    const { error } = await supabase.storage.from("content-images").upload(path, bytes, { contentType: type.mime });
    if (error) return { ok: false, error: "Upload failed." };
    return { ok: true, data: { src: `storage:${path}` } };
  } catch (e) {
    return fail(e, "Could not upload the image.");
  }
}

const bulkSchema = z.object({
  title: z.string().trim().min(3).max(200),
  subjectId: z.uuid(),
  contentType: z.enum(["study_note", "ebook", "revision_sheet", "exam_guide", "topic_summary", "question_bank", "sample_chapter"]),
  price: z.string().trim().max(12),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  description: z.string().trim().min(10, "Description needs at least 10 characters").max(2000),
});

/**
 * Bulk upload step 1: create a DRAFT item with a minimal content version so a
 * PDF can be attached. Never publishes anything.
 */
export async function createDraftForPdf(input: z.input<typeof bulkSchema>): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await assertPermission("content.edit");
    const m = bulkSchema.parse(input);
    const price = m.price ? parseMajorToMinor(m.price, m.currency) : 0;
    if (price === null) return { ok: false, error: "Invalid price." };
    const supabase = await createSupabaseServerClient();
    const slug = `${slugify(m.title).slice(0, 60) || "untitled"}-${Date.now().toString(36)}`;
    const { data, error } = await supabase
      .from("content_items")
      .insert({
        title: m.title,
        slug,
        description: m.description,
        subject_id: m.subjectId,
        content_type: m.contentType,
        price_minor_units: price,
        currency: m.currency,
        is_free: price === 0,
        pdf_downloadable: true,
        author_id: user.id,
      })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: dbError(error?.message) };
    const content = {
      schemaVersion: 1 as const,
      learningObjectives: [],
      prerequisites: [],
      references: [],
      sections: [{ id: "about", title: "About this title", kind: "overview" as const, preview: true, blocks: [{ type: "paragraph" as const, text: m.description }] }],
    };
    const { error: vErr } = await supabase.rpc("create_content_version", {
      p_item: data.id,
      p_content: content,
      p_change_summary: "Created by bulk PDF upload",
      p_reading_minutes: null,
    });
    if (vErr) return { ok: false, error: dbError(vErr.message) };
    return { ok: true, data: { id: data.id as string } };
  } catch (e) {
    return fail(e, "Could not create the draft.");
  }
}
