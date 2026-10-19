import "server-only";
import { cache } from "react";
import { isDemoMode } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fixtureItems, fixtureSubjects, fixtureTopics } from "@/lib/data/fixtures";
import { searchFixtures } from "./fixture-search";
import type { CatalogFilters, CatalogItem, Paginated, Subject, Topic } from "./types";

/**
 * Public catalog reads. In production these go through Supabase with the
 * visitor's own session, so RLS limits results to published content. In demo
 * mode the bundled fixtures are used. Neither path returns note bodies.
 */

export const DEFAULT_PAGE_SIZE = 12;

const ITEM_SELECT = `
  id, title, slug, subtitle, description, subject_id, content_type, difficulty, cover_image,
  price_minor_units, currency, is_free, subscription_eligible, publication_status,
  estimated_reading_minutes, byline, reviewer_name, reviewed_at, learning_objectives,
  current_version_number, pdf_available, pdf_downloadable, published_at, updated_at, featured,
  subject:subjects ( id, name, slug ),
  topic:topics ( id, name, slug ),
  content_tags ( tag ),
  bundle_items!bundle_items_bundle_id_fkey ( content_item_id, sort_order )
`;

type Row = Record<string, unknown> & {
  content_tags?: { tag: string }[];
  bundle_items?: { content_item_id: string; sort_order: number }[];
};

function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

export function mapItemRow(row: Row, ratings?: Map<string, { avg: number; count: number }>): CatalogItem {
  const r = row as Record<string, never>;
  const rating = ratings?.get(r.id);
  return {
    id: r.id,
    title: r.title,
    slug: r.slug,
    subtitle: r.subtitle ?? null,
    description: r.description ?? "",
    subject_id: r.subject_id,
    subject: one(r.subject),
    topic: one(r.topic),
    content_type: r.content_type,
    difficulty: r.difficulty,
    cover_image: r.cover_image ?? null,
    price_minor_units: r.price_minor_units,
    currency: r.currency,
    is_free: r.is_free,
    subscription_eligible: r.subscription_eligible,
    publication_status: r.publication_status,
    estimated_reading_minutes: r.estimated_reading_minutes ?? 0,
    byline: r.byline ?? null,
    reviewer_name: r.reviewer_name ?? null,
    reviewed_at: r.reviewed_at ?? null,
    learning_objectives: r.learning_objectives ?? [],
    tags: (row.content_tags ?? []).map((t) => t.tag),
    version_number: r.current_version_number ?? null,
    has_pdf: Boolean(r.pdf_available),
    pdf_downloadable: Boolean(r.pdf_downloadable),
    published_at: r.published_at ?? null,
    updated_at: r.updated_at,
    featured: Boolean(r.featured),
    rating_average: rating ? rating.avg : null,
    rating_count: rating?.count ?? 0,
    bundle_item_ids: (row.bundle_items ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((b) => b.content_item_id),
  };
}

async function loadRatings(ids: string[]) {
  const map = new Map<string, { avg: number; count: number }>();
  if (!ids.length) return map;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("content_ratings")
    .select("content_item_id, rating_average, rating_count")
    .in("content_item_id", ids);
  for (const r of data ?? []) {
    map.set(r.content_item_id as string, { avg: Number(r.rating_average), count: Number(r.rating_count) });
  }
  return map;
}

async function fetchItemsByIds(ids: string[]): Promise<CatalogItem[]> {
  if (!ids.length) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("content_items")
    .select(ITEM_SELECT)
    .in("id", ids)
    .eq("publication_status", "published");
  if (error) throw new CatalogUnavailableError(error.message);
  const ratings = await loadRatings(ids);
  const byId = new Map((data as Row[]).map((row) => [row.id as string, mapItemRow(row, ratings)]));
  return ids.map((id) => byId.get(id)).filter((x): x is CatalogItem => Boolean(x));
}

export class CatalogUnavailableError extends Error {
  constructor(detail: string) {
    super("The catalog is temporarily unavailable.");
    this.name = "CatalogUnavailableError";
    // Detail is logged server-side, never shown to visitors.
    console.error("[catalog]", detail);
  }
}

export const listSubjects = cache(async (): Promise<Subject[]> => {
  if (isDemoMode()) return fixtureSubjects.filter((s) => s.published);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("subjects")
    .select("id, name, slug, description, cover_image, published, sort_order")
    .eq("published", true)
    .order("sort_order")
    .order("name");
  if (error) throw new CatalogUnavailableError(error.message);
  return data as Subject[];
});

export const getSubjectBySlug = cache(async (slug: string): Promise<(Subject & { topics: Topic[] }) | null> => {
  if (isDemoMode()) {
    const s = fixtureSubjects.find((x) => x.slug === slug && x.published);
    return s ? { ...s, topics: fixtureTopics.filter((t) => t.subject_id === s.id) } : null;
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("subjects")
    .select("id, name, slug, description, cover_image, published, sort_order, topics ( id, subject_id, name, slug, sort_order )")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  if (error) throw new CatalogUnavailableError(error.message);
  if (!data) return null;
  const topics = ((data.topics ?? []) as (Topic & { sort_order: number })[]).sort((a, b) => a.sort_order - b.sort_order);
  return { ...(data as unknown as Subject), topics };
});

export const searchCatalog = cache(async (filters: CatalogFilters): Promise<Paginated<CatalogItem>> => {
  const page = Math.max(1, Math.trunc(filters.page ?? 1));
  const pageSize = Math.min(48, Math.max(1, Math.trunc(filters.pageSize ?? DEFAULT_PAGE_SIZE)));
  if (isDemoMode()) return searchFixtures(fixtureItems, filters, page, pageSize);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("search_catalog", {
    p_query: filters.q?.trim() || null,
    p_subject: filters.subject || null,
    p_topic: filters.topic || null,
    p_difficulty: filters.difficulty || null,
    p_type: filters.type || null,
    p_price: filters.price || null,
    p_published_after: filters.publishedAfter || null,
    p_sort: filters.sort || (filters.q ? "relevance" : "newest"),
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  });
  if (error) throw new CatalogUnavailableError(error.message);
  const rows = (data ?? []) as { id: string; total_count: number }[];
  const total = rows.length ? Number(rows[0].total_count) : 0;
  const items = await fetchItemsByIds(rows.map((r) => r.id));
  return { items, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
});

export const getItemBySlug = cache(async (slug: string): Promise<CatalogItem | null> => {
  if (isDemoMode()) return fixtureItems.find((i) => i.slug === slug && i.publication_status === "published") ?? null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("content_items")
    .select(ITEM_SELECT)
    .eq("slug", slug)
    .eq("publication_status", "published")
    .maybeSingle();
  if (error) throw new CatalogUnavailableError(error.message);
  if (!data) return null;
  const ratings = await loadRatings([data.id as string]);
  return mapItemRow(data as Row, ratings);
});

export async function getItemsByIds(ids: string[]): Promise<CatalogItem[]> {
  if (isDemoMode()) {
    return ids.map((id) => fixtureItems.find((i) => i.id === id)).filter((x): x is CatalogItem => Boolean(x));
  }
  return fetchItemsByIds(ids);
}

/** Bundles that include the given item, for cross-selling on product pages. */
export async function getBundlesContaining(itemId: string): Promise<CatalogItem[]> {
  if (isDemoMode()) return fixtureItems.filter((i) => i.bundle_item_ids?.includes(itemId));
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("bundle_items").select("bundle_id").eq("content_item_id", itemId);
  return fetchItemsByIds((data ?? []).map((r) => r.bundle_id as string));
}

export type HomeCollections = {
  featured: CatalogItem[];
  popular: CatalogItem[];
  recent: CatalogItem[];
  beginner: CatalogItem[];
  free: CatalogItem[];
  bundles: CatalogItem[];
};

export const getHomeCollections = cache(async (): Promise<HomeCollections> => {
  if (isDemoMode()) {
    const published = fixtureItems.filter((i) => i.publication_status === "published");
    const byNewest = [...published].sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""));
    return {
      featured: published.filter((i) => i.featured && i.content_type !== "bundle").slice(0, 4),
      // Demo mode has no sales data, so "popular" is not shown.
      popular: [],
      recent: byNewest.filter((i) => i.content_type !== "bundle").slice(0, 4),
      beginner: published.filter((i) => i.difficulty === "beginner").slice(0, 4),
      free: published.filter((i) => i.is_free).slice(0, 4),
      bundles: published.filter((i) => i.content_type === "bundle").slice(0, 3),
    };
  }
  const supabase = await createSupabaseServerClient();
  const [featured, recent, beginner, free, bundles, popular] = await Promise.all([
    supabase.from("content_items").select("id").eq("publication_status", "published").eq("featured", true)
      .neq("content_type", "bundle").order("published_at", { ascending: false }).limit(4),
    supabase.from("content_items").select("id").eq("publication_status", "published")
      .neq("content_type", "bundle").order("published_at", { ascending: false }).limit(4),
    supabase.from("content_items").select("id").eq("publication_status", "published").eq("difficulty", "beginner")
      .order("published_at", { ascending: false }).limit(4),
    supabase.from("content_items").select("id").eq("publication_status", "published").eq("is_free", true)
      .order("published_at", { ascending: false }).limit(4),
    supabase.from("content_items").select("id").eq("publication_status", "published").eq("content_type", "bundle")
      .order("published_at", { ascending: false }).limit(3),
    supabase.rpc("popular_content", { p_limit: 4 }),
  ]);
  const ids = (r: { data: { id: string }[] | null }) => (r.data ?? []).map((x) => x.id);
  const [f, rc, bg, fr, bd, pp] = await Promise.all([
    fetchItemsByIds(ids(featured)),
    fetchItemsByIds(ids(recent)),
    fetchItemsByIds(ids(beginner)),
    fetchItemsByIds(ids(free)),
    fetchItemsByIds(ids(bundles)),
    fetchItemsByIds(ids(popular as { data: { id: string }[] | null })),
  ]);
  return { featured: f, recent: rc, beginner: bg, free: fr, bundles: bd, popular: pp };
});

export async function getSearchSuggestions(prefix: string): Promise<{ title: string; slug: string }[]> {
  const q = prefix.trim();
  if (q.length < 2) return [];
  if (isDemoMode()) {
    const lower = q.toLowerCase();
    return fixtureItems
      .filter((i) => i.title.toLowerCase().includes(lower) || i.tags.some((t) => t.includes(lower)))
      .slice(0, 6)
      .map((i) => ({ title: i.title, slug: i.slug }));
  }
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("search_suggestions", { p_prefix: q.slice(0, 100) });
  return (data ?? []) as { title: string; slug: string }[];
}

export async function getSubjectCounts(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (isDemoMode()) {
    for (const i of fixtureItems) map.set(i.subject_id, (map.get(i.subject_id) ?? 0) + 1);
    return map;
  }
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("content_items").select("subject_id").eq("publication_status", "published");
  for (const r of data ?? []) map.set(r.subject_id as string, (map.get(r.subject_id as string) ?? 0) + 1);
  return map;
}

/** All published slugs, for the sitemap. */
export async function listPublishedForSitemap(): Promise<{ slug: string; updated_at: string }[]> {
  if (isDemoMode()) return fixtureItems.map((i) => ({ slug: i.slug, updated_at: i.updated_at }));
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("content_items")
    .select("slug, updated_at")
    .eq("publication_status", "published")
    .limit(5000);
  return (data ?? []) as { slug: string; updated_at: string }[];
}
