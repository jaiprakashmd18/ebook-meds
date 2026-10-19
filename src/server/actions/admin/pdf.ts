"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { assertPermission, AuthorizationError } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { structuredContentSchema } from "@/lib/content/schema";
import { verifyPdfBytes } from "@/lib/pdf/verify";
import { renderEbookPdf } from "@/lib/pdf/document";
import { publicEnv } from "@/lib/env";
import type { ActionResult } from "../types";

function fail(e: unknown, fallback: string): ActionResult<never> {
  if (e instanceof AuthorizationError) return { ok: false, error: e.message };
  if (e instanceof z.ZodError) return { ok: false, error: "Invalid request." };
  console.error("[admin pdf]", e instanceof Error ? e.message : e);
  return { ok: false, error: fallback };
}

async function currentVersion(itemId: string) {
  // Staff can read drafts and versions through RLS.
  const supabase = await createSupabaseServerClient();
  const { data: item } = await supabase
    .from("content_items")
    .select("id, title, subtitle, byline, reviewer_name, updated_at, current_version_id, current_version_number, subject:subjects(name)")
    .eq("id", itemId)
    .maybeSingle();
  if (!item?.current_version_id) return null;
  const { data: version } = await supabase
    .from("content_versions")
    .select("id, version_number, structured_content")
    .eq("id", item.current_version_id)
    .maybeSingle();
  if (!version) return null;
  return { item, version };
}

/**
 * Attach a verified PDF to the current version. PDF metadata columns are not
 * client-writable, so this runs with the service role after the permission
 * check and the file checks have passed.
 */
async function attachVerifiedPdf(itemId: string, versionId: string, path: string, pageCount: number, size: number) {
  const admin = createSupabaseAdminClient();
  const { error: vErr } = await admin
    .from("content_versions")
    .update({ pdf_storage_path: path, pdf_page_count: pageCount, pdf_size_bytes: size, pdf_checked_at: new Date().toISOString() })
    .eq("id", versionId)
    .eq("content_item_id", itemId);
  if (vErr) throw new Error(vErr.message);
  const { error: iErr } = await admin.from("content_items").update({ pdf_available: true }).eq("id", itemId).eq("current_version_id", versionId);
  if (iErr) throw new Error(iErr.message);
}

export async function createPdfUploadUrl(itemId: string): Promise<ActionResult<{ signedUrl: string; path: string }>> {
  try {
    await assertPermission("content.edit");
    const id = z.uuid().parse(itemId);
    const cur = await currentVersion(id);
    if (!cur) return { ok: false, error: "Save the content at least once before attaching a PDF." };
    const path = `${id}/v${cur.version.version_number}-${Date.now()}.pdf`;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.storage.from("ebooks").createSignedUploadUrl(path);
    if (error || !data) return { ok: false, error: "Could not prepare the upload." };
    return { ok: true, data: { signedUrl: data.signedUrl, path } };
  } catch (e) {
    return fail(e, "Could not prepare the upload.");
  }
}

export async function verifyUploadedPdf(itemId: string, path: string): Promise<ActionResult<{ pageCount: number }>> {
  try {
    const user = await assertPermission("content.edit");
    const id = z.uuid().parse(itemId);
    // The file must belong to this item's folder.
    if (!path.startsWith(`${id}/`) || path.includes("..") || !path.endsWith(".pdf")) {
      return { ok: false, error: "That file does not belong to this item." };
    }
    const cur = await currentVersion(id);
    if (!cur) return { ok: false, error: "This item has no content version." };
    const admin = createSupabaseAdminClient();
    const { data: blob, error } = await admin.storage.from("ebooks").download(path);
    if (error || !blob) return { ok: false, error: "The uploaded file could not be found." };
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const check = await verifyPdfBytes(bytes);
    if (!check.ok) {
      await admin.storage.from("ebooks").remove([path]);
      return { ok: false, error: `PDF rejected: ${check.reason}` };
    }
    await attachVerifiedPdf(id, cur.version.id, path, check.pageCount, check.sizeBytes);
    const supabase = await createSupabaseServerClient();
    await supabase.rpc("log_audit_event", {
      p_action: "content.pdf_attached",
      p_resource_type: "content_item",
      p_resource_id: id,
      p_metadata: { path, pages: check.pageCount, bytes: check.sizeBytes, by: user.id, source: "upload" },
    });
    revalidatePath(`/admin/content/${id}`);
    return { ok: true, message: `PDF verified: ${check.pageCount} pages.`, data: { pageCount: check.pageCount } };
  } catch (e) {
    return fail(e, "Could not verify the PDF.");
  }
}

export async function generatePdf(itemId: string): Promise<ActionResult<{ pageCount: number }>> {
  try {
    const user = await assertPermission("content.edit");
    const id = z.uuid().parse(itemId);
    const cur = await currentVersion(id);
    if (!cur) return { ok: false, error: "Save the content at least once before generating a PDF." };
    const parsed = structuredContentSchema.safeParse(cur.version.structured_content);
    if (!parsed.success) return { ok: false, error: "The current version does not pass validation." };
    const subject = Array.isArray(cur.item.subject) ? cur.item.subject[0] : cur.item.subject;
    const buf = await renderEbookPdf(
      {
        title: cur.item.title as string,
        subtitle: (cur.item.subtitle as string | null) ?? parsed.data.subtitle ?? null,
        subject: (subject as { name: string } | null)?.name ?? "",
        byline: cur.item.byline as string | null,
        reviewerName: cur.item.reviewer_name as string | null,
        versionNumber: cur.version.version_number as number,
        updatedAt: new Date().toISOString(),
        siteUrl: publicEnv.siteUrl,
      },
      parsed.data,
    );
    const bytes = new Uint8Array(buf);
    const check = await verifyPdfBytes(bytes);
    if (!check.ok) return { ok: false, error: `Generated PDF failed checks: ${check.reason}` };
    const path = `${id}/v${cur.version.version_number}-${Date.now()}.pdf`;
    const admin = createSupabaseAdminClient();
    const { error } = await admin.storage.from("ebooks").upload(path, bytes, { contentType: "application/pdf" });
    if (error) return { ok: false, error: "Could not store the generated PDF." };
    await attachVerifiedPdf(id, cur.version.id as string, path, check.pageCount, check.sizeBytes);
    const supabase = await createSupabaseServerClient();
    await supabase.rpc("log_audit_event", {
      p_action: "content.pdf_generated",
      p_resource_type: "content_item",
      p_resource_id: id,
      p_metadata: { path, pages: check.pageCount, by: user.id },
    });
    revalidatePath(`/admin/content/${id}`);
    return { ok: true, message: `Generated a ${check.pageCount}-page PDF for version ${cur.version.version_number}.`, data: { pageCount: check.pageCount } };
  } catch (e) {
    return fail(e, "PDF generation failed.");
  }
}

/** Short-lived link for staff to check the stored PDF. */
export async function getStaffPdfLink(itemId: string, path: string): Promise<ActionResult<{ url: string }>> {
  try {
    await assertPermission("content.read_drafts");
    const id = z.uuid().parse(itemId);
    if (!path.startsWith(`${id}/`)) return { ok: false, error: "Invalid file." };
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.storage.from("ebooks").createSignedUrl(path, 60);
    if (error || !data) return { ok: false, error: "Could not create a link." };
    return { ok: true, data: { url: data.signedUrl } };
  } catch (e) {
    return fail(e, "Could not create a link.");
  }
}
