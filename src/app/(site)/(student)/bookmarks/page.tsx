import type { Metadata } from "next";
import Link from "next/link";
import { Bookmark } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getBookmarks } from "@/lib/data/student";
import { formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Bookmarks" };

export default async function BookmarksPage() {
  const user = await requireUser("/bookmarks");
  const rows = await getBookmarks(user);
  const groups = new Map<string, typeof rows>();
  for (const r of rows) groups.set(r.item.id, [...(groups.get(r.item.id) ?? []), r]);
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-semibold tracking-tight">Bookmarks</h1>
      {!rows.length ? (
        <EmptyState icon={<Bookmark />} title="No bookmarks yet" description="Use the bookmark button in the reader to save chapters you want to come back to." />
      ) : (
        [...groups.values()].map((list) => (
          <section key={list[0].item.id} aria-labelledby={`b-${list[0].item.id}`}>
            <h2 id={`b-${list[0].item.id}`} className="mb-3 font-semibold">{list[0].item.title}</h2>
            <ul className="flex flex-col divide-y divide-border rounded-[var(--radius-md)] border border-border">
              {list.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <Link href={`/reader/${b.item.slug}`} className="hover:text-accent">{b.section_title ?? <span className="text-muted-foreground">Section no longer in the current version</span>}</Link>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDate(b.created_at)}</span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
