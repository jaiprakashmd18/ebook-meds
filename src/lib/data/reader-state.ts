import "server-only";
import { isDemoMode } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SessionUser } from "@/lib/auth/session";
import type { SavedHighlight } from "@/server/actions/reader";

export type ReaderState = {
  sectionId: string | null;
  scroll: number;
  completionPercentage: number;
  bookmarks: string[];
  completed: string[];
  highlights: SavedHighlight[];
};

export const EMPTY_READER_STATE: ReaderState = {
  sectionId: null,
  scroll: 0,
  completionPercentage: 0,
  bookmarks: [],
  completed: [],
  highlights: [],
};

export async function getReaderState(user: SessionUser | null, itemId: string): Promise<ReaderState> {
  if (isDemoMode() || !user) return EMPTY_READER_STATE;
  const supabase = await createSupabaseServerClient();
  const [progress, bookmarks, completions, highlights] = await Promise.all([
    supabase.from("reading_progress").select("section_id, scroll_position, completion_percentage").eq("user_id", user.id).eq("content_item_id", itemId).maybeSingle(),
    supabase.from("bookmarks").select("section_id").eq("user_id", user.id).eq("content_item_id", itemId),
    supabase.from("section_completions").select("section_id").eq("user_id", user.id).eq("content_item_id", itemId),
    supabase
      .from("highlights")
      .select("id, section_id, selected_text, prefix, suffix, private_note, content_version_id, created_at")
      .eq("user_id", user.id)
      .eq("content_item_id", itemId)
      .order("created_at"),
  ]);
  return {
    sectionId: (progress.data?.section_id as string | null) ?? null,
    scroll: Number(progress.data?.scroll_position ?? 0),
    completionPercentage: Number(progress.data?.completion_percentage ?? 0),
    bookmarks: (bookmarks.data ?? []).map((b) => b.section_id as string),
    completed: (completions.data ?? []).map((c) => c.section_id as string),
    highlights: (highlights.data ?? []) as SavedHighlight[],
  };
}
