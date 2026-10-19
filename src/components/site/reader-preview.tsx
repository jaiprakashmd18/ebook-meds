import Link from "next/link";
import type { CatalogItem } from "@/lib/data/types";
import type { Section } from "@/lib/content/schema";
import { SectionView } from "@/components/content/blocks";

/** A static, real excerpt of a note rendered in the reader's styling. */
export function ReaderPreview({ item, section }: { item: CatalogItem; section: Section }) {
  return (
    <div
      data-reader-theme="light"
      className="relative overflow-hidden rounded-[var(--radius-xl)] border border-border bg-[var(--reader-bg)] text-[var(--reader-fg)] shadow-lg"
    >
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        <span className="size-2.5 rounded-full bg-border-strong" aria-hidden />
        <span className="size-2.5 rounded-full bg-border-strong" aria-hidden />
        <span className="size-2.5 rounded-full bg-border-strong" aria-hidden />
        <span className="ml-3 truncate text-xs text-muted-foreground">
          {item.subject?.name} · {item.title}
        </span>
      </div>
      <div className="grid md:grid-cols-[180px_1fr]">
        <aside className="hidden border-r border-border bg-surface/60 p-5 md:block" aria-hidden>
          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Contents</p>
          <p className="mt-3 text-[13px] font-medium text-accent">{section.title}</p>
          <div className="mt-3 flex flex-col gap-2">
            {[70, 85, 60, 75].map((w, i) => (
              <span key={i} className="h-2 rounded-full bg-border" style={{ width: `${w}%` }} />
            ))}
          </div>
        </aside>
        <div className="prose-study relative max-h-[420px] overflow-hidden px-6 py-6 text-[15px] sm:px-8" style={{ ["--reader-font-size" as string]: "15px" }}>
          <SectionView section={section} />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[var(--reader-bg)] to-transparent" />
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
        <span>Real excerpt from a free note</span>
        <Link href={`/reader/${item.slug}`} className="font-medium text-accent hover:underline">
          Keep reading
        </Link>
      </div>
    </div>
  );
}
