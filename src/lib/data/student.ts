import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { structuredContentSchema } from "@/lib/content/schema";
import { getItemsByIds } from "./catalog";
import type { CatalogItem } from "./types";
import type { SessionUser } from "@/lib/auth/session";

/*
 * Student data. Every query runs as the signed-in user, so RLS limits rows to
 * their own records. Nothing here is fabricated: empty states are shown when
 * there is no activity.
 */

export type ProgressRow = {
  item: CatalogItem;
  section_id: string | null;
  completion_percentage: number;
  last_read_at: string;
};

export const getProgress = cache(async (user: SessionUser): Promise<ProgressRow[]> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("reading_progress")
    .select("content_item_id, section_id, completion_percentage, last_read_at")
    .eq("user_id", user.id)
    .order("last_read_at", { ascending: false })
    .limit(100);
  const rows = data ?? [];
  const items = await getItemsByIds(rows.map((r) => r.content_item_id as string));
  const byId = new Map(items.map((i) => [i.id, i]));
  return rows
    .filter((r) => byId.has(r.content_item_id as string))
    .map((r) => ({
      item: byId.get(r.content_item_id as string)!,
      section_id: r.section_id as string | null,
      completion_percentage: r.completion_percentage as number,
      last_read_at: r.last_read_at as string,
    }));
});

export type OwnedItem = { item: CatalogItem; via: "purchase" | "bundle" | "grant" | "subscription"; since: string };

export const getLibrary = cache(async (user: SessionUser): Promise<OwnedItem[]> => {
  const supabase = await createSupabaseServerClient();
  const [{ data: purchases }, { data: grants }] = await Promise.all([
    supabase.from("purchases").select("product_id, created_at").eq("user_id", user.id).eq("access_status", "active"),
    supabase.from("access_grants").select("content_item_id, created_at, expires_at, revoked_at").eq("user_id", user.id).is("revoked_at", null),
  ]);
  const owned = new Map<string, { via: OwnedItem["via"]; since: string }>();
  const productIds = (purchases ?? []).map((p) => p.product_id as string);
  const products = await getItemsByIds(productIds);
  for (const p of purchases ?? []) {
    const product = products.find((x) => x.id === p.product_id);
    if (!product) continue;
    if (product.content_type === "bundle") {
      for (const child of product.bundle_item_ids ?? []) if (!owned.has(child)) owned.set(child, { via: "bundle", since: p.created_at as string });
    } else {
      owned.set(product.id, { via: "purchase", since: p.created_at as string });
    }
  }
  for (const g of grants ?? []) {
    if (g.expires_at && new Date(g.expires_at as string) < new Date()) continue;
    if (!owned.has(g.content_item_id as string)) owned.set(g.content_item_id as string, { via: "grant", since: g.created_at as string });
  }
  const items = await getItemsByIds([...owned.keys()]);
  return items
    .map((item) => ({ item, ...owned.get(item.id)! }))
    .sort((a, b) => b.since.localeCompare(a.since));
});

/** Map of item id → (section id → title) for the current versions the user can read. */
async function sectionTitles(itemIds: string[]): Promise<Map<string, Map<string, string>>> {
  const out = new Map<string, Map<string, string>>();
  if (!itemIds.length) return out;
  const supabase = await createSupabaseServerClient();
  const { data: items } = await supabase.from("content_items").select("id, current_version_id").in("id", itemIds);
  const versionIds = (items ?? []).map((i) => i.current_version_id).filter(Boolean) as string[];
  if (!versionIds.length) return out;
  const { data: versions } = await supabase.from("content_versions").select("content_item_id, structured_content").in("id", versionIds);
  for (const v of versions ?? []) {
    const parsed = structuredContentSchema.safeParse(v.structured_content);
    if (parsed.success) out.set(v.content_item_id as string, new Map(parsed.data.sections.map((s) => [s.id, s.title])));
  }
  return out;
}

export type BookmarkRow = { id: string; item: CatalogItem; section_id: string; section_title: string | null; created_at: string };

export async function getBookmarks(user: SessionUser): Promise<BookmarkRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("bookmarks")
    .select("id, content_item_id, section_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = data ?? [];
  const ids = [...new Set(rows.map((r) => r.content_item_id as string))];
  const [items, titles] = await Promise.all([getItemsByIds(ids), sectionTitles(ids)]);
  const byId = new Map(items.map((i) => [i.id, i]));
  return rows
    .filter((r) => byId.has(r.content_item_id as string))
    .map((r) => ({
      id: r.id as string,
      item: byId.get(r.content_item_id as string)!,
      section_id: r.section_id as string,
      section_title: titles.get(r.content_item_id as string)?.get(r.section_id as string) ?? null,
      created_at: r.created_at as string,
    }));
}

export type HighlightRow = {
  id: string;
  item: CatalogItem;
  section_id: string;
  section_title: string | null;
  selected_text: string;
  private_note: string | null;
  created_at: string;
  outdated: boolean;
};

export async function getHighlights(user: SessionUser): Promise<HighlightRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("highlights")
    .select("id, content_item_id, content_version_id, section_id, selected_text, private_note, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(500);
  const rows = data ?? [];
  const ids = [...new Set(rows.map((r) => r.content_item_id as string))];
  const [items, titles, { data: current }] = await Promise.all([
    getItemsByIds(ids),
    sectionTitles(ids),
    supabase.from("content_items").select("id, current_version_id").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
  ]);
  const byId = new Map(items.map((i) => [i.id, i]));
  const currentVersion = new Map((current ?? []).map((c) => [c.id as string, c.current_version_id as string | null]));
  return rows
    .filter((r) => byId.has(r.content_item_id as string))
    .map((r) => ({
      id: r.id as string,
      item: byId.get(r.content_item_id as string)!,
      section_id: r.section_id as string,
      section_title: titles.get(r.content_item_id as string)?.get(r.section_id as string) ?? null,
      selected_text: r.selected_text as string,
      private_note: r.private_note as string | null,
      created_at: r.created_at as string,
      outdated: Boolean(r.content_version_id && currentVersion.get(r.content_item_id as string) !== r.content_version_id),
    }));
}

export type OrderRow = {
  id: string;
  amount_minor_units: number;
  subtotal_minor_units: number;
  discount_minor_units: number;
  refunded_minor_units: number;
  currency: string;
  payment_status: string;
  provider: string | null;
  created_at: string;
  paid_at: string | null;
  order_items: { product_id: string; product_title_snapshot: string; unit_price_minor_units: number; currency: string }[];
};

export async function getOrders(user: SessionUser): Promise<OrderRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("orders")
    .select("id, amount_minor_units, subtotal_minor_units, discount_minor_units, refunded_minor_units, currency, payment_status, provider, created_at, paid_at, order_items(product_id, product_title_snapshot, unit_price_minor_units, currency)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []) as OrderRow[];
}

export async function getOrder(user: SessionUser, id: string): Promise<OrderRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("orders")
    .select("id, amount_minor_units, subtotal_minor_units, discount_minor_units, refunded_minor_units, currency, payment_status, provider, created_at, paid_at, order_items(product_id, product_title_snapshot, unit_price_minor_units, currency)")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  return (data as OrderRow | null) ?? null;
}

export type SubscriptionRow = {
  id: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  provider: string;
  plans: { name: string; price_minor_units: number; currency: string; billing_interval: string } | null;
};

export async function getSubscription(user: SessionUser): Promise<SubscriptionRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("id, status, current_period_end, cancel_at_period_end, provider, plans(name, price_minor_units, currency, billing_interval)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as SubscriptionRow | null) ?? null;
}

export function subscriptionIsActive(s: SubscriptionRow | null): boolean {
  return Boolean(
    s && ["active", "trialing", "past_due"].includes(s.status) && s.current_period_end && new Date(s.current_period_end) > new Date(),
  );
}

export async function getRecentCompletions(user: SessionUser) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("section_completions")
    .select("content_item_id, section_id, completed_at")
    .eq("user_id", user.id)
    .order("completed_at", { ascending: false })
    .limit(8);
  const rows = data ?? [];
  const ids = [...new Set(rows.map((r) => r.content_item_id as string))];
  const [items, titles] = await Promise.all([getItemsByIds(ids), sectionTitles(ids)]);
  const byId = new Map(items.map((i) => [i.id, i]));
  return rows
    .filter((r) => byId.has(r.content_item_id as string))
    .map((r) => ({
      item: byId.get(r.content_item_id as string)!,
      section_title: titles.get(r.content_item_id as string)?.get(r.section_id as string) ?? r.section_id,
      completed_at: r.completed_at as string,
    }));
}
