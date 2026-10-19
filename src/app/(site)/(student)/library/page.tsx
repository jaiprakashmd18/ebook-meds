import type { Metadata } from "next";
import Link from "next/link";
import { Library } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getLibrary, getProgress } from "@/lib/data/student";
import { formatDate } from "@/lib/utils";
import { Cover } from "@/components/site/cover";
import { EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Library" };

const VIA = { purchase: "Purchased", bundle: "Included in a bundle", grant: "Access granted", subscription: "Subscription" };

export default async function LibraryPage() {
  const user = await requireUser("/library");
  const [owned, progress] = await Promise.all([getLibrary(user), getProgress(user)]);
  const ownedIds = new Set(owned.map((o) => o.item.id));
  const saved = progress.filter((p) => p.item.is_free && !ownedIds.has(p.item.id));
  return (
    <div className="flex flex-col gap-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Library</h1>
        <p className="mt-1 text-muted-foreground">Titles you own, plus free notes you have started reading.</p>
      </header>
      {!owned.length && !saved.length ? (
        <EmptyState icon={<Library />} title="Your library is empty" description="Purchased titles appear here as soon as your payment is confirmed." action={<Button asChild><Link href="/explore">Explore notes</Link></Button>} />
      ) : null}
      {owned.length ? (
        <section aria-labelledby="owned">
          <h2 id="owned" className="mb-4 text-xl font-semibold">Purchased and granted</h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {owned.map(({ item, via, since }) => (
              <li key={item.id} className="flex gap-4 rounded-[var(--radius-lg)] border border-border p-4">
                <div className="w-16 shrink-0"><Cover item={item} size="sm" /></div>
                <div className="flex min-w-0 flex-col">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{VIA[via]} · {formatDate(since)}{item.version_number ? ` · latest v${item.version_number}` : ""}</p>
                  <div className="mt-auto flex gap-3 pt-3 text-sm">
                    <Link href={`/reader/${item.slug}`} className="text-accent hover:underline">Read</Link>
                    {item.pdf_downloadable && item.has_pdf ? <a href={`/api/downloads/${item.slug}`} className="text-accent hover:underline">Download PDF</a> : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {saved.length ? (
        <section aria-labelledby="saved">
          <h2 id="saved" className="mb-4 text-xl font-semibold">Free notes you are reading</h2>
          <ul className="flex flex-col gap-2">
            {saved.map((p) => <li key={p.item.id}><Link href={`/reader/${p.item.slug}`} className="hover:text-accent">{p.item.title}</Link> <span className="text-sm text-muted-foreground">· {p.completion_percentage}%</span></li>)}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
