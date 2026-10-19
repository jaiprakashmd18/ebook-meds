import "server-only";
import { cache } from "react";
import { isDemoMode } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { fixtureVersions } from "@/lib/data/fixtures";
import { previewOf, structuredContentSchema, type StructuredContent } from "@/lib/content/schema";
import type { CatalogItem, ContentVersion } from "@/lib/data/types";
import { getCurrentUser } from "@/lib/auth/session";

export type AccessDecision =
  | { granted: true; reason: "free" | "entitled" }
  | { granted: false; reason: "unauthenticated" | "not_entitled" };

/**
 * Decide on the server whether the current visitor may read the full item.
 * Never trust client flags: the decision comes from the database function
 * `can_access_content`, evaluated for the verified session user.
 */
export const resolveAccess = cache(async (item: Pick<CatalogItem, "id" | "is_free" | "publication_status">): Promise<AccessDecision> => {
  if (item.is_free && item.publication_status === "published") return { granted: true, reason: "free" };
  if (isDemoMode()) return { granted: false, reason: "unauthenticated" };
  const user = await getCurrentUser();
  if (!user) return { granted: false, reason: "unauthenticated" };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("can_access_content", { p_item: item.id });
  if (error) {
    console.error("[access] can_access_content failed", error.message);
    return { granted: false, reason: "not_entitled" };
  }
  return data === true ? { granted: true, reason: "entitled" } : { granted: false, reason: "not_entitled" };
});

/** Load the current version of an item. Server-only; callers must check access first. */
async function loadCurrentVersion(itemId: string, granted: boolean): Promise<ContentVersion | null> {
  if (isDemoMode()) return fixtureVersions.find((v) => v.content_item_id === itemId) ?? null;

  // Entitled users can read the current version through RLS. Previews of paid
  // items need the service role, because RLS hides bodies from non-owners;
  // the caller then strips everything except preview sections.
  const supabase = granted || !isAdminClientConfigured() ? await createSupabaseServerClient() : createSupabaseAdminClient();
  const { data: item } = await supabase.from("content_items").select("current_version_id").eq("id", itemId).maybeSingle();
  if (!item?.current_version_id) return null;
  const { data, error } = await supabase
    .from("content_versions")
    .select("id, content_item_id, version_number, structured_content, pdf_storage_path, change_summary, created_at")
    .eq("id", item.current_version_id)
    .maybeSingle();
  if (error || !data) return null;
  return data as ContentVersion;
}

export type ReadableContent = {
  access: AccessDecision;
  version: Pick<ContentVersion, "id" | "version_number" | "created_at"> | null;
  /** Full document when access is granted, otherwise preview sections only. */
  content: StructuredContent | null;
  isPreview: boolean;
  totalSections: number;
  /** Titles of every section (safe to show to anyone: no body text). */
  outline: { id: string; title: string; preview: boolean }[];
};

export const getReadableContent = cache(async (item: CatalogItem): Promise<ReadableContent> => {
  const access = await resolveAccess(item);
  const version = await loadCurrentVersion(item.id, access.granted);
  if (!version) return { access, version: null, content: null, isPreview: !access.granted, totalSections: 0, outline: [] };

  const parsed = structuredContentSchema.safeParse(version.structured_content);
  if (!parsed.success) {
    console.error("[access] stored content failed validation", item.id, parsed.error.issues.slice(0, 3));
    return { access, version: null, content: null, isPreview: !access.granted, totalSections: 0, outline: [] };
  }
  const full = parsed.data;
  const previewIds = new Set(previewOf(full).sections.map((s) => s.id));
  return {
    access,
    version: { id: version.id, version_number: version.version_number, created_at: version.created_at },
    content: access.granted ? full : previewOf(full),
    isPreview: !access.granted,
    totalSections: full.sections.length,
    outline: full.sections.map((s) => ({ id: s.id, title: s.title, preview: previewIds.has(s.id) })),
  };
});

/** Preview content regardless of access (for /preview pages). */
export async function getPreviewContent(item: CatalogItem): Promise<{ content: StructuredContent | null; totalSections: number }> {
  const access = await resolveAccess(item);
  const version = await loadCurrentVersion(item.id, access.granted);
  if (!version) return { content: null, totalSections: 0 };
  const parsed = structuredContentSchema.safeParse(version.structured_content);
  if (!parsed.success) return { content: null, totalSections: 0 };
  return { content: previewOf(parsed.data), totalSections: parsed.data.sections.length };
}
