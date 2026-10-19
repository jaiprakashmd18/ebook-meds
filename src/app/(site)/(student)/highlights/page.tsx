import type { Metadata } from "next";
import Link from "next/link";
import { Highlighter } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getHighlights } from "@/lib/data/student";
import { formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Highlights and notes" };

export default async function HighlightsPage() {
  const user = await requireUser("/highlights");
  const rows = await getHighlights(user);
  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Highlights and notes</h1>
        <p className="mt-1 text-muted-foreground">Your private notes are visible only to you.</p>
      </header>
      {!rows.length ? (
        <EmptyState icon={<Highlighter />} title="Nothing highlighted yet" description="Select text in the reader to highlight it or attach a private note." />
      ) : (
        <ul className="flex flex-col gap-4">
          {rows.map((h) => (
            <li key={h.id} className="rounded-[var(--radius-lg)] border border-border p-5">
              <p className="text-xs text-muted-foreground">
                <Link href={`/reader/${h.item.slug}`} className="font-medium text-accent hover:underline">{h.item.title}</Link>
                {h.section_title ? ` · ${h.section_title}` : ""} · {formatDate(h.created_at)}
              </p>
              <blockquote className="mt-2 border-l-2 border-warning pl-3 text-[15px]">{h.selected_text}</blockquote>
              {h.private_note ? <p className="mt-3 rounded-md bg-surface p-3 text-sm">{h.private_note}</p> : null}
              {h.outdated ? <p className="mt-2 text-xs text-warning">Made on an earlier version of these notes; the text may have been revised.</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
