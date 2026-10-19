"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { assertPermission, AuthorizationError } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { subjectSchema, topicSchema } from "@/lib/validation/admin";
import type { ActionResult } from "../types";

function fail(e: unknown, fallback: string): ActionResult<never> {
  if (e instanceof AuthorizationError) return { ok: false, error: e.message };
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Invalid input" };
  return { ok: false, error: fallback };
}

const fromForm = (fd: FormData) => ({
  name: fd.get("name"),
  slug: fd.get("slug"),
  description: fd.get("description") ?? "",
  published: fd.get("published") === "on",
  sortOrder: fd.get("sortOrder") ?? 0,
});

export async function saveSubject(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await assertPermission("categories.manage");
    const id = fd.get("id") ? z.uuid().parse(fd.get("id")) : null;
    const s = subjectSchema.parse(fromForm(fd));
    const supabase = await createSupabaseServerClient();
    const row = { name: s.name, slug: s.slug, description: s.description, published: s.published, sort_order: s.sortOrder };
    const { error } = id ? await supabase.from("subjects").update(row).eq("id", id) : await supabase.from("subjects").insert(row);
    if (error) return { ok: false, error: error.message.includes("subjects_slug_key") ? "That slug is already in use." : "Could not save the subject." };
    revalidatePath("/admin/categories");
    revalidatePath("/subjects");
    return { ok: true, message: id ? "Subject updated." : "Subject created." };
  } catch (e) {
    return fail(e, "Could not save the subject.");
  }
}

export async function deleteSubject(id: string): Promise<ActionResult> {
  try {
    await assertPermission("settings.manage");
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("subjects").delete().eq("id", z.uuid().parse(id));
    if (error) return { ok: false, error: "Subjects that still have content cannot be deleted. Hide it instead." };
    revalidatePath("/admin/categories");
    return { ok: true, message: "Subject deleted." };
  } catch (e) {
    return fail(e, "Could not delete the subject.");
  }
}

export async function addTopic(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await assertPermission("categories.manage");
    const t = topicSchema.parse({ subjectId: fd.get("subjectId"), name: fd.get("name"), slug: fd.get("slug") });
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("topics").insert({ subject_id: t.subjectId, name: t.name, slug: t.slug });
    if (error) return { ok: false, error: "Could not add the topic (is the slug unique within the subject?)." };
    revalidatePath("/admin/categories");
    return { ok: true, message: "Topic added." };
  } catch (e) {
    return fail(e, "Could not add the topic.");
  }
}

export async function deleteTopic(id: string): Promise<ActionResult> {
  try {
    await assertPermission("categories.manage");
    const supabase = await createSupabaseServerClient();
    await supabase.from("topics").delete().eq("id", z.uuid().parse(id));
    revalidatePath("/admin/categories");
    return { ok: true, message: "Topic removed." };
  } catch (e) {
    return fail(e, "Could not remove the topic.");
  }
}

const reportUpdate = z.object({
  id: z.uuid(),
  status: z.enum(["open", "in_review", "resolved", "rejected"]),
  note: z.string().trim().max(4000).optional(),
});

export async function updateReport(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const user = await assertPermission("corrections.manage");
    const r = reportUpdate.parse({ id: fd.get("id"), status: fd.get("status"), note: fd.get("note") ?? undefined });
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("content_reports")
      .update({ status: r.status, admin_note: r.note || null, resolved_by: ["resolved", "rejected"].includes(r.status) ? user.id : null })
      .eq("id", r.id);
    if (error) return { ok: false, error: "Could not update the report." };
    await supabase.rpc("log_audit_event", { p_action: "report.updated", p_resource_type: "content_report", p_resource_id: r.id, p_metadata: { status: r.status } });
    revalidatePath("/admin/corrections");
    return { ok: true, message: "Report updated." };
  } catch (e) {
    return fail(e, "Could not update the report.");
  }
}

export async function moderateReview(id: string, status: "approved" | "rejected" | "removed"): Promise<ActionResult> {
  try {
    await assertPermission("reviews.moderate");
    const supabase = await createSupabaseServerClient();
    const { error, count } = await supabase
      .from("reviews")
      .update({ moderation_status: z.enum(["approved", "rejected", "removed"]).parse(status) }, { count: "exact" })
      .eq("id", z.uuid().parse(id));
    if (error || !count) return { ok: false, error: "Could not update the review." };
    await supabase.rpc("log_audit_event", { p_action: `review.${status}`, p_resource_type: "review", p_resource_id: id, p_metadata: {} });
    revalidatePath("/admin/reviews");
    return { ok: true, message: `Review ${status}.` };
  } catch (e) {
    return fail(e, "Could not update the review.");
  }
}
