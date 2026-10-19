import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ContentType, Difficulty, PublicationStatus } from "./types";

export type AdminContentRow = {
  id: string;
  title: string;
  slug: string;
  content_type: ContentType;
  publication_status: PublicationStatus;
  is_free: boolean;
  price_minor_units: number;
  currency: string;
  current_version_number: number | null;
  pdf_available: boolean;
  pdf_downloadable: boolean;
  updated_at: string;
  subject: { name: string } | null;
};

export async function listAdminContent(filters: { status?: string; q?: string }) {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("content_items")
    .select("id, title, slug, content_type, publication_status, is_free, price_minor_units, currency, current_version_number, pdf_available, pdf_downloadable, updated_at, subject:subjects(name)")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (filters.status && ["draft", "review", "published", "archived"].includes(filters.status)) {
    query = query.eq("publication_status", filters.status);
  }
  if (filters.q) query = query.ilike("title", `%${filters.q.replace(/[%_]/g, "")}%`);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ ...r, subject: Array.isArray(r.subject) ? r.subject[0] ?? null : r.subject })) as AdminContentRow[];
}

export type AdminSubject = {
  id: string;
  name: string;
  slug: string;
  description: string;
  published: boolean;
  sort_order: number;
  topics: { id: string; name: string; slug: string }[];
};

export async function listAdminSubjects(): Promise<AdminSubject[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("subjects")
    .select("id, name, slug, description, published, sort_order, topics(id, name, slug)")
    .order("sort_order")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminSubject[];
}

export type AdminContentDetail = {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string;
  subject_id: string;
  topic_id: string | null;
  content_type: ContentType;
  difficulty: Difficulty;
  cover_image: string | null;
  price_minor_units: number;
  currency: string;
  is_free: boolean;
  subscription_eligible: boolean;
  publication_status: PublicationStatus;
  byline: string | null;
  reviewer_name: string | null;
  reviewed_at: string | null;
  learning_objectives: string[];
  current_version_id: string | null;
  current_version_number: number | null;
  pdf_downloadable: boolean;
  pdf_available: boolean;
  featured: boolean;
  published_at: string | null;
  updated_at: string;
  tags: string[];
  bundle_item_ids: string[];
  versions: {
    id: string;
    version_number: number;
    change_summary: string | null;
    created_at: string;
    pdf_storage_path: string | null;
    pdf_page_count: number | null;
    pdf_size_bytes: number | null;
    pdf_checked_at: string | null;
  }[];
  current_content: unknown;
};

export async function getAdminContent(id: string): Promise<AdminContentDetail | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("content_items")
    .select(
      "*, content_tags(tag), bundle_items!bundle_items_bundle_id_fkey(content_item_id, sort_order), content_versions!content_versions_content_item_id_fkey(id, version_number, change_summary, created_at, pdf_storage_path, pdf_page_count, pdf_size_bytes, pdf_checked_at)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  let current_content: unknown = null;
  if (data.current_version_id) {
    const { data: v } = await supabase.from("content_versions").select("structured_content").eq("id", data.current_version_id).maybeSingle();
    current_content = v?.structured_content ?? null;
  }
  const row = data as Record<string, unknown> & {
    content_tags: { tag: string }[];
    bundle_items: { content_item_id: string; sort_order: number }[];
    content_versions: AdminContentDetail["versions"];
  };
  return {
    ...(row as unknown as AdminContentDetail),
    tags: row.content_tags.map((t) => t.tag),
    bundle_item_ids: row.bundle_items.sort((a, b) => a.sort_order - b.sort_order).map((b) => b.content_item_id),
    versions: row.content_versions.sort((a, b) => b.version_number - a.version_number),
    current_content,
  };
}

export async function listBundleCandidates() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("content_items")
    .select("id, title, publication_status")
    .neq("content_type", "bundle")
    .eq("is_free", false)
    .order("title");
  return (data ?? []) as { id: string; title: string; publication_status: string }[];
}
