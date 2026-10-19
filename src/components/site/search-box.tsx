"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function SearchBox({ initial = "", history = [] }: { initial?: string; history?: string[] }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  const [suggestions, setSuggestions] = useState<{ title: string; slug: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const handle = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        const json = (await res.json()) as { suggestions: { title: string; slug: string }[] };
        setSuggestions(json.suggestions);
      } catch {
        /* network errors simply mean no suggestions */
      }
    }, 180);
    return () => clearTimeout(handle);
  }, [q]);

  const shown = q.trim().length >= 2 ? suggestions : [];
  const showHistory = !q.trim() && history.length > 0;

  const submit = (value: string) => {
    setOpen(false);
    router.push(value.trim() ? `/search?q=${encodeURIComponent(value.trim())}` : "/search");
  };

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (active >= 0 && shown[active]) router.push(`/notes/${shown[active].slug}`);
        else submit(q);
      }}
      className="relative"
    >
      <label htmlFor="search-q" className="sr-only">Search notes</label>
      <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        id="search-q"
        name="q"
        type="search"
        autoComplete="off"
        placeholder="Search topics, subjects or keywords"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, shown.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, -1));
          } else if (e.key === "Escape") setOpen(false);
        }}
        role="combobox"
        aria-expanded={open && (shown.length > 0 || showHistory)}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        className="h-14 rounded-full pl-12 text-[17px]"
      />
      {open && (shown.length > 0 || showHistory) ? (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-16 z-20 overflow-hidden rounded-[var(--radius-lg)] border border-border bg-background py-2 shadow-lg">
          {showHistory ? <li className="px-4 py-1 text-xs text-muted-foreground" role="presentation">Recent searches</li> : null}
          {showHistory
            ? history.map((h) => (
                <li key={h} role="option" aria-selected={false}>
                  <button type="button" className="w-full px-4 py-2 text-left text-sm hover:bg-surface" onMouseDown={() => { setQ(h); submit(h); }}>
                    {h}
                  </button>
                </li>
              ))
            : shown.map((s, i) => (
                <li key={s.slug} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-surface ${i === active ? "bg-surface" : ""}`}
                    onMouseDown={() => router.push(`/notes/${s.slug}`)}
                  >
                    {s.title}
                  </button>
                </li>
              ))}
        </ul>
      ) : null}
    </form>
  );
}
