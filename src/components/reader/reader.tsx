"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Highlighter,
  List,
  Lock,
  Minus,
  NotebookPen,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  createHighlight,
  deleteHighlight,
  saveReadingPosition,
  setBookmark,
  setSectionCompleted,
  updateHighlightNote,
  type SavedHighlight,
} from "@/server/actions/reader";
import type { ReaderState } from "@/lib/data/reader-state";
import { cn } from "@/lib/utils";
import { findTextRange } from "./text-range";

export type ReaderSection = { id: string; title: string; minutes: number; text: string; node: React.ReactNode };
type Theme = "light" | "sepia" | "dark";
type Panel = null | "search" | "notes";

const FONT_SIZES = [15, 16, 17, 18, 20, 22];
const PREFS_KEY = "ss-reader-prefs";

function loadPrefs(): { theme: Theme; size: number } {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as { theme?: Theme; size?: number };
      return {
        theme: p.theme && ["light", "sepia", "dark"].includes(p.theme) ? p.theme : "light",
        size: p.size && FONT_SIZES.includes(p.size) ? p.size : 17,
      };
    }
  } catch {
    /* storage may be unavailable (private mode); defaults are fine */
  }
  return { theme: "light", size: 17 };
}

export function Reader({
  item,
  versionId,
  versionNumber,
  sections,
  lockedSections,
  initialState,
  signedIn,
  canPersist,
  isPreview,
  paywall,
}: {
  item: { id: string; slug: string; title: string; subtitle: string | null; subject: string; pdf: boolean };
  versionId: string | null;
  versionNumber: number | null;
  sections: ReaderSection[];
  lockedSections: { id: string; title: string }[];
  initialState: ReaderState;
  signedIn: boolean;
  canPersist: boolean;
  isPreview: boolean;
  paywall: React.ReactNode;
}) {
  const startIndex = Math.max(0, sections.findIndex((s) => s.id === initialState.sectionId));
  const [index, setIndex] = useState(startIndex);
  const [theme, setTheme] = useState<Theme>("light");
  const [size, setSize] = useState(17);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [bookmarks, setBookmarks] = useState(() => new Set(initialState.bookmarks));
  const [completed, setCompleted] = useState(() => new Set(initialState.completed));
  const [percentage, setPercentage] = useState(initialState.completionPercentage);
  const [highlights, setHighlights] = useState<SavedHighlight[]>(initialState.highlights);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("");
  const [selection, setSelection] = useState<null | { x: number; y: number; text: string; sectionId: string; prefix: string; suffix: string }>(null);
  const [noteDraft, setNoteDraft] = useState<{ text: string; note: string } | null>(null);
  const [orphaned, setOrphaned] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();
  const articleRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const restoredRef = useRef(false);

  const current = sections[index];
  const isLast = index === sections.length - 1;

  // Preferences are a per-device convenience kept in localStorage.
  useEffect(() => {
    const p = loadPrefs();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate client-only preferences after mount
    setTheme(p.theme);
    setSize(p.size);
    setPrefsLoaded(true);
  }, []);
  useEffect(() => {
    if (!prefsLoaded) return;
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify({ theme, size }));
    } catch {
      /* ignore */
    }
  }, [theme, size, prefsLoaded]);

  const announce = (msg: string) => setStatus(msg);

  const persistPosition = useCallback(
    (sectionId: string) => {
      if (!canPersist) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const scroll = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      startTransition(async () => {
        const res = await saveReadingPosition({ itemId: item.id, sectionId, scroll });
        if (!res.ok) announce(res.error);
      });
    },
    [canPersist, item.id],
  );

  const goTo = useCallback(
    (i: number) => {
      if (i < 0 || i >= sections.length) return;
      setIndex(i);
      setTocOpen(false);
      setSelection(null);
      window.scrollTo({ top: 0 });
      persistPosition(sections[i].id);
      requestAnimationFrame(() => document.getElementById(`h-${sections[i].id}`)?.focus({ preventScroll: true }));
    },
    [sections, persistPosition],
  );

  // Resume from the saved scroll position once.
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    if (initialState.sectionId === current?.id && initialState.scroll > 0) {
      requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo({ top: initialState.scroll * max });
      });
    }
  }, [current?.id, initialState.scroll, initialState.sectionId]);

  // Save the scroll position periodically while reading.
  useEffect(() => {
    if (!canPersist || !current) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      clearTimeout(timer);
      timer = setTimeout(() => persistPosition(current.id), 2500);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(timer);
    };
  }, [canPersist, current, persistPosition]);

  // Keyboard navigation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
        if (e.key === "Escape") (t as HTMLInputElement).blur();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight") goTo(index + 1);
      else if (e.key === "ArrowLeft") goTo(index - 1);
      else if (e.key === "/") {
        e.preventDefault();
        setPanel("search");
        requestAnimationFrame(() => searchRef.current?.focus());
      } else if (e.key === "Escape") {
        setPanel(null);
        setTocOpen(false);
        setSelection(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, index]);

  // Paint highlights for the visible section with the CSS Custom Highlight API
  // (no DOM mutation, so React's tree is untouched).
  useEffect(() => {
    if (!current) return;
    const root = articleRef.current?.querySelector<HTMLElement>(`[data-section-id="${current.id}"] [data-highlight-root]`);
    const registry = (globalThis as unknown as { CSS?: { highlights?: Map<string, unknown> } }).CSS?.highlights;
    const HighlightCtor = (globalThis as unknown as { Highlight?: new (...r: Range[]) => unknown }).Highlight;
    const missing = new Set<string>();
    const ranges: Range[] = [];
    if (root) {
      for (const h of highlights.filter((x) => x.section_id === current.id)) {
        const range = findTextRange(root, h.selected_text, h.prefix ?? "");
        if (range) ranges.push(range);
        else missing.add(h.id);
      }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- derived from the rendered DOM, which is only available after paint
    setOrphaned((prev) => {
      const next = new Set([...prev].filter((id) => !highlights.some((h) => h.id === id && h.section_id === current.id)));
      missing.forEach((id) => next.add(id));
      return next;
    });
    if (registry && HighlightCtor) {
      if (ranges.length) registry.set("ss-highlight", new HighlightCtor(...ranges));
      else registry.delete("ss-highlight");
    }
    return () => {
      registry?.delete("ss-highlight");
    };
  }, [current, highlights, size]);

  // Selection → highlight toolbar.
  const onSelectionEnd = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount || !current) {
      setSelection(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const root = articleRef.current?.querySelector<HTMLElement>(`[data-section-id="${current.id}"] [data-highlight-root]`);
    if (!root || !root.contains(range.commonAncestorContainer)) {
      setSelection(null);
      return;
    }
    const text = sel.toString().trim();
    if (!text || text.length > 2000) {
      setSelection(null);
      return;
    }
    const before = document.createRange();
    before.setStart(root, 0);
    before.setEnd(range.startContainer, range.startOffset);
    const after = document.createRange();
    after.setStart(range.endContainer, range.endOffset);
    after.setEnd(root, root.childNodes.length);
    const rect = range.getBoundingClientRect();
    setSelection({
      x: rect.left + rect.width / 2,
      y: rect.top,
      text,
      sectionId: current.id,
      prefix: before.toString().slice(-32),
      suffix: after.toString().slice(0, 32),
    });
  };

  const saveHighlight = (note?: string) => {
    if (!selection) return;
    const sel = selection;
    setSelection(null);
    setNoteDraft(null);
    window.getSelection()?.removeAllRanges();
    startTransition(async () => {
      const res = await createHighlight({
        itemId: item.id,
        versionId,
        sectionId: sel.sectionId,
        text: sel.text,
        prefix: sel.prefix,
        suffix: sel.suffix,
        note,
      });
      if (res.ok && res.data) {
        setHighlights((h) => [...h, res.data as SavedHighlight]);
        announce(note ? "Highlight and note saved." : "Highlight saved.");
      } else if (!res.ok) announce(res.error);
    });
  };

  const toggleBookmark = () => {
    if (!current) return;
    const on = !bookmarks.has(current.id);
    setBookmarks((b) => {
      const n = new Set(b);
      if (on) n.add(current.id);
      else n.delete(current.id);
      return n;
    });
    startTransition(async () => {
      const res = await setBookmark({ itemId: item.id, sectionId: current.id, bookmarked: on });
      if (!res.ok) {
        announce(res.error);
        setBookmarks((b) => {
          const n = new Set(b);
          if (on) n.delete(current.id);
          else n.add(current.id);
          return n;
        });
      } else announce(on ? "Bookmarked." : "Bookmark removed.");
    });
  };

  const toggleComplete = () => {
    if (!current) return;
    const on = !completed.has(current.id);
    setCompleted((c) => {
      const n = new Set(c);
      if (on) n.add(current.id);
      else n.delete(current.id);
      return n;
    });
    startTransition(async () => {
      const res = await setSectionCompleted({ itemId: item.id, sectionId: current.id, completed: on });
      if (res.ok && res.data) {
        setPercentage(res.data.percentage);
        announce(on ? "Section marked as complete." : "Section marked as not complete.");
      } else if (!res.ok) announce(res.error);
    });
  };

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const out: { index: number; title: string; snippet: string }[] = [];
    sections.forEach((s, i) => {
      const hay = s.text.toLowerCase();
      let from = 0;
      let count = 0;
      while (count < 3) {
        const at = hay.indexOf(q, from);
        if (at === -1) break;
        const start = Math.max(0, at - 50);
        out.push({
          index: i,
          title: s.title,
          snippet: `${start > 0 ? "…" : ""}${s.text.slice(start, at + q.length + 60).replace(/\s+/g, " ")}…`,
        });
        from = at + q.length;
        count++;
      }
    });
    return out.slice(0, 40);
  }, [query, sections]);

  const remaining = sections.slice(index).reduce((sum, s) => sum + s.minutes, 0);
  const locationPct = Math.round(((index + 1) / Math.max(1, sections.length + lockedSections.length)) * 100);

  if (!current) return null;

  return (
    <div
      data-reader-theme={theme}
      className="min-h-dvh bg-[var(--reader-bg)] text-[var(--reader-fg)] transition-colors"
      style={{ ["--reader-font-size" as string]: `${size}px` }}
    >
      <div aria-live="polite" className="sr-only">{status}</div>

      <header className="sticky top-0 z-30 border-b border-[var(--reader-border)] bg-[var(--reader-bg)]/90 backdrop-blur">
        <div className="flex h-14 items-center gap-1 px-2 sm:px-4">
          <Link href={`/notes/${item.slug}`} className="rounded-full p-2 hover:bg-[var(--reader-panel)]" aria-label="Back to title page">
            <ArrowLeft className="size-5" />
          </Link>
          <button className="rounded-full p-2 hover:bg-[var(--reader-panel)] lg:hidden" onClick={() => setTocOpen((v) => !v)} aria-label="Table of contents" aria-expanded={tocOpen}>
            <List className="size-5" />
          </button>
          <div className="min-w-0 flex-1 px-2">
            <p className="truncate text-sm font-semibold">{item.title}</p>
            <p className="truncate text-xs text-[var(--reader-muted)]">
              {isPreview ? "Free preview" : `${percentage}% complete`} · {remaining} min left
              {versionNumber ? ` · v${versionNumber}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-0.5">
            <button className="rounded-full p-2 hover:bg-[var(--reader-panel)]" onClick={() => setSize(FONT_SIZES[Math.max(0, FONT_SIZES.indexOf(size) - 1)])} disabled={size === FONT_SIZES[0]} aria-label="Decrease font size">
              <Minus className="size-4" />
            </button>
            <span className="hidden w-8 text-center text-xs tabular-nums sm:inline" aria-label={`Font size ${size} pixels`}>{size}</span>
            <button className="rounded-full p-2 hover:bg-[var(--reader-panel)]" onClick={() => setSize(FONT_SIZES[Math.min(FONT_SIZES.length - 1, FONT_SIZES.indexOf(size) + 1)])} disabled={size === FONT_SIZES[FONT_SIZES.length - 1]} aria-label="Increase font size">
              <Plus className="size-4" />
            </button>
            <div role="radiogroup" aria-label="Reading theme" className="mx-1 hidden items-center gap-1 sm:flex">
              {(["light", "sepia", "dark"] as Theme[]).map((t) => (
                <button
                  key={t}
                  role="radio"
                  aria-checked={theme === t}
                  aria-label={`${t[0].toUpperCase()}${t.slice(1)} theme`}
                  onClick={() => setTheme(t)}
                  className={cn("size-6 rounded-full border", theme === t ? "ring-2 ring-accent ring-offset-1" : "")}
                  style={{ background: t === "light" ? "#fff" : t === "sepia" ? "#f8f1e3" : "#121212", borderColor: "#c7c7cc" }}
                />
              ))}
            </div>
            <button className="rounded-full p-2 hover:bg-[var(--reader-panel)]" onClick={() => { setPanel(panel === "search" ? null : "search"); requestAnimationFrame(() => searchRef.current?.focus()); }} aria-label="Search in this document" aria-pressed={panel === "search"}>
              <Search className="size-4" />
            </button>
            {canPersist ? (
              <>
                <button className="rounded-full p-2 hover:bg-[var(--reader-panel)]" onClick={() => setPanel(panel === "notes" ? null : "notes")} aria-label="Highlights and notes" aria-pressed={panel === "notes"}>
                  <NotebookPen className="size-4" />
                </button>
                <button className="rounded-full p-2 hover:bg-[var(--reader-panel)]" onClick={toggleBookmark} aria-label={bookmarks.has(current.id) ? "Remove bookmark" : "Bookmark this chapter"} aria-pressed={bookmarks.has(current.id)}>
                  {bookmarks.has(current.id) ? <BookmarkCheck className="size-4 text-accent" /> : <Bookmark className="size-4" />}
                </button>
              </>
            ) : null}
            {item.pdf && !isPreview ? (
              <a href={`/api/downloads/${item.slug}`} className="rounded-full p-2 hover:bg-[var(--reader-panel)]" aria-label="Download PDF">
                <Download className="size-4" />
              </a>
            ) : null}
          </div>
        </div>
        <div className="h-0.5 bg-[var(--reader-border)]" aria-hidden>
          <div className="h-full bg-accent transition-[width]" style={{ width: `${isPreview ? locationPct : Math.max(percentage, 1)}%` }} />
        </div>
        <div className="flex justify-center gap-2 py-1.5 sm:hidden" role="radiogroup" aria-label="Reading theme">
          {(["light", "sepia", "dark"] as Theme[]).map((t) => (
            <button key={t} role="radio" aria-checked={theme === t} onClick={() => setTheme(t)} className={cn("rounded-full px-3 py-0.5 text-xs", theme === t ? "bg-accent text-white" : "bg-[var(--reader-panel)]")}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </header>

      <div className="mx-auto flex max-w-[1240px]">
        <nav
          aria-label="Table of contents"
          className={cn(
            "fixed inset-y-14 left-0 z-20 w-72 overflow-y-auto border-r border-[var(--reader-border)] bg-[var(--reader-bg)] p-4 lg:sticky lg:top-14 lg:block lg:h-[calc(100dvh-3.5rem)]",
            tocOpen ? "block" : "hidden",
          )}
        >
          <p className="px-2 text-[11px] font-semibold tracking-wide text-[var(--reader-muted)] uppercase">Contents</p>
          <ol className="mt-2 flex flex-col gap-0.5">
            {sections.map((s, i) => (
              <li key={s.id}>
                <button
                  onClick={() => goTo(i)}
                  aria-current={i === index ? "true" : undefined}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-[var(--reader-panel)]",
                    i === index && "bg-[var(--reader-panel)] font-medium text-accent",
                  )}
                >
                  <span className="mt-0.5 w-4 shrink-0">
                    {completed.has(s.id) ? <Check className="size-3.5 text-success" aria-label="Completed" /> : <span className="text-xs text-[var(--reader-muted)]">{i + 1}</span>}
                  </span>
                  <span className="flex-1">{s.title}</span>
                  {bookmarks.has(s.id) ? <Bookmark className="mt-0.5 size-3 fill-current text-accent" aria-label="Bookmarked" /> : null}
                </button>
              </li>
            ))}
            {lockedSections.map((s) => (
              <li key={s.id} className="flex items-start gap-2 px-2 py-2 text-sm text-[var(--reader-muted)]">
                <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span>{s.title}<span className="sr-only"> (locked)</span></span>
              </li>
            ))}
          </ol>
          {!signedIn ? (
            <p className="mt-6 rounded-lg bg-[var(--reader-panel)] p-3 text-xs text-[var(--reader-muted)]">
              <Link href={`/auth/login?next=/reader/${item.slug}`} className="text-accent underline">Sign in</Link> to save progress, bookmarks and highlights.
            </p>
          ) : null}
        </nav>

        <main id="main" className="min-w-0 flex-1 px-5 pt-10 pb-28 sm:px-10">
          <article ref={articleRef} className="prose-study mx-auto max-w-[680px]" onMouseUp={canPersist ? onSelectionEnd : undefined} onKeyUp={canPersist ? onSelectionEnd : undefined}>
            {index === 0 ? (
              <div className="mb-10">
                <p className="text-sm font-medium text-accent">{item.subject}</p>
                <h1 className="mt-1 text-[1.9em] leading-tight font-semibold tracking-tight">{item.title}</h1>
                {item.subtitle ? <p className="mt-2 text-[1.1em] text-[var(--reader-muted)]">{item.subtitle}</p> : null}
              </div>
            ) : null}
            <div key={current.id} tabIndex={-1}>{current.node}</div>
          </article>

          <div className="mx-auto mt-14 flex max-w-[680px] flex-col gap-4">
            {canPersist ? (
              <button
                onClick={toggleComplete}
                aria-pressed={completed.has(current.id)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium",
                  completed.has(current.id) ? "border-success bg-success-soft text-success" : "border-[var(--reader-border)] hover:bg-[var(--reader-panel)]",
                )}
              >
                <Check className="size-4" /> {completed.has(current.id) ? "Completed" : "Mark section as complete"}
              </button>
            ) : null}
            <div className="flex items-stretch gap-3">
              <button onClick={() => goTo(index - 1)} disabled={index === 0} className="flex min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--reader-border)] p-4 text-left text-sm hover:bg-[var(--reader-panel)] disabled:opacity-40">
                <ChevronLeft className="size-4 shrink-0" aria-hidden />
                <span className="min-w-0"><span className="block text-xs text-[var(--reader-muted)]">Previous</span><span className="block truncate font-medium">{sections[index - 1]?.title ?? "—"}</span></span>
              </button>
              <button onClick={() => goTo(index + 1)} disabled={isLast} className="flex min-w-0 flex-1 items-center justify-end gap-2 rounded-[var(--radius-md)] border border-[var(--reader-border)] p-4 text-right text-sm hover:bg-[var(--reader-panel)] disabled:opacity-40">
                <span className="min-w-0"><span className="block text-xs text-[var(--reader-muted)]">Next</span><span className="block truncate font-medium">{sections[index + 1]?.title ?? "—"}</span></span>
                <ChevronRight className="size-4 shrink-0" aria-hidden />
              </button>
            </div>
            <p className="text-center text-xs text-[var(--reader-muted)]">Use ← and → to move between chapters, / to search.</p>
            {isLast && paywall ? paywall : null}
          </div>
        </main>

        {panel ? (
          <aside className="fixed inset-x-0 bottom-0 z-30 max-h-[70dvh] overflow-y-auto border-t border-[var(--reader-border)] bg-[var(--reader-bg)] p-5 shadow-lg sm:inset-y-14 sm:right-0 sm:left-auto sm:max-h-none sm:w-96 sm:border-t-0 sm:border-l" aria-label={panel === "search" ? "Search in document" : "Highlights and notes"}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">{panel === "search" ? "Search in this document" : "Highlights and notes"}</h2>
              <button onClick={() => setPanel(null)} className="rounded-full p-1.5 hover:bg-[var(--reader-panel)]" aria-label="Close panel"><X className="size-4" /></button>
            </div>
            {panel === "search" ? (
              <>
                <label htmlFor="doc-search" className="sr-only">Search text</label>
                <input
                  id="doc-search"
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search…"
                  className="h-10 w-full rounded-lg border border-[var(--reader-border)] bg-transparent px-3 text-sm"
                />
                <p className="mt-2 text-xs text-[var(--reader-muted)]" aria-live="polite">
                  {query.trim().length >= 2 ? `${results.length} match${results.length === 1 ? "" : "es"}${isPreview ? " in the preview" : ""}` : "Type at least 2 characters."}
                </p>
                <ul className="mt-3 flex flex-col gap-2">
                  {results.map((r, i) => (
                    <li key={i}>
                      <button
                        onClick={() => {
                          goTo(r.index);
                          // On small screens the panel covers the text; close it after jumping.
                          if (window.matchMedia("(max-width: 639px)").matches) setPanel(null);
                        }}
                        className="w-full rounded-lg p-2.5 text-left text-sm hover:bg-[var(--reader-panel)]"
                      >
                        <span className="block text-xs font-medium text-accent">{r.title}</span>
                        <span className="mt-0.5 block text-[var(--reader-muted)]">{r.snippet}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <HighlightsPanel
                highlights={highlights}
                sections={sections}
                versionId={versionId}
                orphaned={orphaned}
                onJump={(sectionId) => goTo(sections.findIndex((s) => s.id === sectionId))}
                onDelete={(id) => {
                  setHighlights((h) => h.filter((x) => x.id !== id));
                  startTransition(async () => {
                    const res = await deleteHighlight({ id });
                    announce(res.ok ? "Highlight deleted." : res.error);
                  });
                }}
                onSaveNote={(id, note) => {
                  setHighlights((h) => h.map((x) => (x.id === id ? { ...x, private_note: note || null } : x)));
                  startTransition(async () => {
                    const res = await updateHighlightNote({ id, note });
                    announce(res.ok ? "Note saved." : res.error);
                  });
                }}
              />
            )}
          </aside>
        ) : null}
      </div>

      {selection ? (
        <div
          role="toolbar"
          aria-label="Selection actions"
          className="fixed z-40 flex -translate-x-1/2 -translate-y-full items-center gap-1 rounded-full bg-[#1d1d1f] p-1 text-white shadow-lg"
          style={{ left: Math.min(Math.max(selection.x, 120), window.innerWidth - 120), top: Math.max(selection.y - 8, 70) }}
        >
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => saveHighlight()} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs hover:bg-white/15">
            <Highlighter className="size-3.5" /> Highlight
          </button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => setNoteDraft({ text: selection.text, note: "" })} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs hover:bg-white/15">
            <NotebookPen className="size-3.5" /> Add note
          </button>
        </div>
      ) : null}

      {noteDraft && selection ? (
        <div role="dialog" aria-modal="true" aria-label="Add a private note" className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center">
          <form
            className="w-full max-w-md rounded-[var(--radius-xl)] bg-[var(--reader-bg)] p-5 shadow-lg"
            onSubmit={(e) => {
              e.preventDefault();
              saveHighlight(noteDraft.note);
            }}
          >
            <p className="text-sm font-semibold">Private note</p>
            <blockquote className="mt-2 border-l-2 border-accent pl-3 text-sm text-[var(--reader-muted)]">{noteDraft.text.slice(0, 280)}</blockquote>
            <label htmlFor="note-text" className="sr-only">Note</label>
            <textarea
              id="note-text"
              autoFocus
              maxLength={5000}
              value={noteDraft.note}
              onChange={(e) => setNoteDraft({ ...noteDraft, note: e.target.value })}
              className="mt-3 min-h-28 w-full rounded-lg border border-[var(--reader-border)] bg-transparent p-3 text-sm"
              placeholder="Only you can see this note."
            />
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => { setNoteDraft(null); setSelection(null); }} className="rounded-full px-4 py-2 text-sm hover:bg-[var(--reader-panel)]">Cancel</button>
              <button type="submit" className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white">Save</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function HighlightsPanel({
  highlights,
  sections,
  versionId,
  orphaned,
  onJump,
  onDelete,
  onSaveNote,
}: {
  highlights: SavedHighlight[];
  sections: ReaderSection[];
  versionId: string | null;
  orphaned: Set<string>;
  onJump: (sectionId: string) => void;
  onDelete: (id: string) => void;
  onSaveNote: (id: string, note: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  if (!highlights.length) {
    return <p className="text-sm text-[var(--reader-muted)]">Select text in the notes to highlight it or add a private note.</p>;
  }
  const titleOf = (id: string) => sections.find((s) => s.id === id)?.title;
  return (
    <ul className="flex flex-col gap-3">
      {highlights.map((h) => {
        const sectionTitle = titleOf(h.section_id);
        const outdated = !sectionTitle || orphaned.has(h.id) || (versionId && h.content_version_id && h.content_version_id !== versionId);
        return (
          <li key={h.id} className="rounded-lg border border-[var(--reader-border)] p-3 text-sm">
            <button className="text-left text-xs font-medium text-accent disabled:text-[var(--reader-muted)]" disabled={!sectionTitle} onClick={() => onJump(h.section_id)}>
              {sectionTitle ?? "Section no longer in this version"}
            </button>
            <p className="mt-1 border-l-2 border-[var(--reader-highlight)] pl-2">{h.selected_text}</p>
            {outdated ? <p className="mt-1 text-xs text-warning">Saved on an earlier version; the text may have changed.</p> : null}
            {editing === h.id ? (
              <div className="mt-2">
                <label htmlFor={`n-${h.id}`} className="sr-only">Edit note</label>
                <textarea id={`n-${h.id}`} value={draft} maxLength={5000} onChange={(e) => setDraft(e.target.value)} className="min-h-20 w-full rounded border border-[var(--reader-border)] bg-transparent p-2 text-sm" />
                <div className="mt-1 flex justify-end gap-2">
                  <button onClick={() => setEditing(null)} className="text-xs">Cancel</button>
                  <button onClick={() => { onSaveNote(h.id, draft); setEditing(null); }} className="text-xs font-medium text-accent">Save</button>
                </div>
              </div>
            ) : (
              <>
                {h.private_note ? <p className="mt-2 rounded bg-[var(--reader-panel)] p-2 text-[13px]">{h.private_note}</p> : null}
                <div className="mt-2 flex gap-3 text-xs">
                  <button onClick={() => { setEditing(h.id); setDraft(h.private_note ?? ""); }} className="text-accent">{h.private_note ? "Edit note" : "Add note"}</button>
                  <button onClick={() => onDelete(h.id)} className="flex items-center gap-1 text-[var(--reader-muted)] hover:text-danger"><Trash2 className="size-3" /> Delete</button>
                </div>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
