"use server";

import { z } from "zod";
import { isDemoMode } from "@/lib/env";
import { assertUser, AuthorizationError } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { structuredContentSchema } from "@/lib/content/schema";
import type { ActionResult } from "./types";

/*
 * Reader persistence. Every write runs with the user's own Supabase session,
 * so RLS guarantees users only touch their own rows and only for content they
 * can access. Inputs are validated here as well.
 */

const sectionId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/);
const itemId = z.uuid();

async function guard<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  if (isDemoMode()) return { ok: false, error: "Saving is unavailable in demo mode." };
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, error: e.message };
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid request." };
    console.error("[reader action]", e instanceof Error ? e.message : e);
    return { ok: false, error: "Could not save. Check your connection and try again." };
  }
}

/** Count sections of the current version on the server; never trust the client total. */
async function sectionCount(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, item: string) {
  const { data: ci } = await supabase.from("content_items").select("current_version_id").eq("id", item).maybeSingle();
  if (!ci?.current_version_id) return { total: 0, ids: new Set<string>() };
  const { data: v } = await supabase.from("content_versions").select("structured_content").eq("id", ci.current_version_id).maybeSingle();
  const parsed = structuredContentSchema.safeParse(v?.structured_content);
  if (!parsed.success) return { total: 0, ids: new Set<string>() };
  return { total: parsed.data.sections.length, ids: new Set(parsed.data.sections.map((s) => s.id)) };
}

async function recomputeCompletion(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  item: string,
): Promise<number> {
  const { total, ids } = await sectionCount(supabase, item);
  const { data } = await supabase.from("section_completions").select("section_id").eq("user_id", userId).eq("content_item_id", item);
  // Only completions of sections that exist in the current version count.
  const done = (data ?? []).filter((r) => ids.has(r.section_id as string)).length;
  return total ? Math.min(100, Math.round((done / total) * 100)) : 0;
}

const progressSchema = z.object({ itemId, sectionId, scroll: z.number().min(0).max(1) });

export async function saveReadingPosition(input: z.input<typeof progressSchema>): Promise<ActionResult> {
  return guard(async () => {
    const { itemId: item, sectionId: section, scroll } = progressSchema.parse(input);
    const user = await assertUser();
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("reading_progress").upsert(
      {
        user_id: user.id,
        content_item_id: item,
        section_id: section,
        scroll_position: Math.round(scroll * 10000) / 10000,
        last_read_at: new Date().toISOString(),
      },
      { onConflict: "user_id,content_item_id" },
    );
    if (error) return { ok: false, error: "Could not save your place." };
    return { ok: true };
  });
}

const completeSchema = z.object({ itemId, sectionId, completed: z.boolean() });

export async function setSectionCompleted(input: z.input<typeof completeSchema>): Promise<ActionResult<{ percentage: number }>> {
  return guard(async () => {
    const { itemId: item, sectionId: section, completed } = completeSchema.parse(input);
    const user = await assertUser();
    const supabase = await createSupabaseServerClient();
    if (completed) {
      const { error } = await supabase
        .from("section_completions")
        .upsert({ user_id: user.id, content_item_id: item, section_id: section }, { onConflict: "user_id,content_item_id,section_id" });
      if (error) return { ok: false, error: "Could not mark this section as complete." };
    } else {
      await supabase.from("section_completions").delete().eq("user_id", user.id).eq("content_item_id", item).eq("section_id", section);
    }
    const percentage = await recomputeCompletion(supabase, user.id, item);
    await supabase.from("reading_progress").upsert(
      { user_id: user.id, content_item_id: item, section_id: section, completion_percentage: percentage, last_read_at: new Date().toISOString() },
      { onConflict: "user_id,content_item_id" },
    );
    return { ok: true, data: { percentage } };
  });
}

const bookmarkSchema = z.object({ itemId, sectionId, bookmarked: z.boolean() });

export async function setBookmark(input: z.input<typeof bookmarkSchema>): Promise<ActionResult> {
  return guard(async () => {
    const { itemId: item, sectionId: section, bookmarked } = bookmarkSchema.parse(input);
    const user = await assertUser();
    const supabase = await createSupabaseServerClient();
    if (bookmarked) {
      const { error } = await supabase
        .from("bookmarks")
        .upsert({ user_id: user.id, content_item_id: item, section_id: section }, { onConflict: "user_id,content_item_id,section_id" });
      if (error) return { ok: false, error: "Could not add the bookmark." };
    } else {
      await supabase.from("bookmarks").delete().eq("user_id", user.id).eq("content_item_id", item).eq("section_id", section);
    }
    return { ok: true };
  });
}

const highlightSchema = z.object({
  itemId,
  versionId: z.uuid().nullable(),
  sectionId,
  text: z.string().trim().min(1).max(2000),
  prefix: z.string().max(64).optional(),
  suffix: z.string().max(64).optional(),
  note: z.string().trim().max(5000).optional(),
});

export type SavedHighlight = {
  id: string;
  section_id: string;
  selected_text: string;
  prefix: string | null;
  suffix: string | null;
  private_note: string | null;
  content_version_id: string | null;
  created_at: string;
};

export async function createHighlight(input: z.input<typeof highlightSchema>): Promise<ActionResult<SavedHighlight>> {
  return guard(async () => {
    const h = highlightSchema.parse(input);
    const user = await assertUser();
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("highlights")
      .insert({
        user_id: user.id,
        content_item_id: h.itemId,
        content_version_id: h.versionId,
        section_id: h.sectionId,
        selected_text: h.text,
        prefix: h.prefix ?? null,
        suffix: h.suffix ?? null,
        private_note: h.note || null,
      })
      .select("id, section_id, selected_text, prefix, suffix, private_note, content_version_id, created_at")
      .single();
    if (error || !data) return { ok: false, error: "Could not save the highlight." };
    return { ok: true, data: data as SavedHighlight };
  });
}

const noteSchema = z.object({ id: z.uuid(), note: z.string().trim().max(5000) });

export async function updateHighlightNote(input: z.input<typeof noteSchema>): Promise<ActionResult> {
  return guard(async () => {
    const { id, note } = noteSchema.parse(input);
    const user = await assertUser();
    const supabase = await createSupabaseServerClient();
    const { error, count } = await supabase
      .from("highlights")
      .update({ private_note: note || null }, { count: "exact" })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error || !count) return { ok: false, error: "Could not update the note." };
    return { ok: true };
  });
}

export async function deleteHighlight(input: { id: string }): Promise<ActionResult> {
  return guard(async () => {
    const id = z.uuid().parse(input.id);
    const user = await assertUser();
    const supabase = await createSupabaseServerClient();
    await supabase.from("highlights").delete().eq("id", id).eq("user_id", user.id);
    return { ok: true };
  });
}
