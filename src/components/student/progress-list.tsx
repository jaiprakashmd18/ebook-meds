import Link from "next/link";
import type { ProgressRow } from "@/lib/data/student";
import { formatDate } from "@/lib/utils";
import { Cover } from "@/components/site/cover";

export function ProgressList({ rows }: { rows: ProgressRow[] }) {
  return (
    <ul className="flex flex-col divide-y divide-border rounded-[var(--radius-lg)] border border-border">
      {rows.map((r) => (
        <li key={r.item.id} className="flex items-center gap-4 p-4">
          <div className="w-12 shrink-0"><Cover item={r.item} size="sm" /></div>
          <div className="min-w-0 flex-1">
            <Link href={`/reader/${r.item.slug}`} className="font-medium hover:text-accent">{r.item.title}</Link>
            <p className="text-xs text-muted-foreground">{r.item.subject?.name} · last read {formatDate(r.last_read_at)}</p>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 max-w-60 flex-1 overflow-hidden rounded-full bg-surface" role="progressbar" aria-valuenow={r.completion_percentage} aria-valuemin={0} aria-valuemax={100} aria-label={`${r.item.title} progress`}>
                <div className="h-full rounded-full bg-accent" style={{ width: `${r.completion_percentage}%` }} />
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">{r.completion_percentage}% of sections completed</span>
            </div>
          </div>
          <Link href={`/reader/${r.item.slug}`} className="hidden text-sm text-accent hover:underline sm:block">Continue</Link>
        </li>
      ))}
    </ul>
  );
}
