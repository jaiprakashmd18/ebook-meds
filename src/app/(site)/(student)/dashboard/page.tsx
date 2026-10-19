import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Compass } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getBookmarks, getLibrary, getOrders, getProgress, getRecentCompletions, getSubscription, subscriptionIsActive } from "@/lib/data/student";
import { searchCatalog } from "@/lib/data/catalog";
import { formatDate } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { ProgressList } from "@/components/student/progress-list";
import { ContentGrid } from "@/components/site/content-card";
import { EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser("/dashboard");
  const [progress, library, bookmarks, completions, orders, subscription, freeNotes, recent] = await Promise.all([
    getProgress(user),
    getLibrary(user),
    getBookmarks(user),
    getRecentCompletions(user),
    getOrders(user),
    getSubscription(user),
    searchCatalog({ price: "free", pageSize: 4 }),
    searchCatalog({ sort: "newest", pageSize: 4 }),
  ]);
  const isNew = !progress.length && !library.length && !bookmarks.length;
  const name = user.displayName?.split(" ")[0];

  return (
    <div className="flex flex-col gap-12">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{name ? `Welcome back, ${name}` : "Your dashboard"}</h1>
        <p className="mt-1 text-muted-foreground">Pick up where you left off, at your own pace.</p>
      </header>

      {isNew ? (
        <EmptyState
          icon={<Compass />}
          title="Start with a free note"
          description="Your reading progress, bookmarks and purchases will appear here. Free notes are a good way to see how StudySimplify explains things."
          action={<div className="flex gap-2"><Button asChild><Link href="/explore?price=free">Browse free notes</Link></Button><Button asChild variant="outline"><Link href="/subjects">Choose a subject</Link></Button></div>}
        />
      ) : null}

      {progress.length ? (
        <section aria-labelledby="continue">
          <h2 id="continue" className="mb-4 text-xl font-semibold">Continue learning</h2>
          <ProgressList rows={progress.slice(0, 3)} />
        </section>
      ) : null}

      {completions.length ? (
        <section aria-labelledby="completed">
          <h2 id="completed" className="mb-4 text-xl font-semibold">Recently completed sections</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {completions.map((c, i) => (
              <li key={i} className="flex justify-between gap-4 border-b border-border pb-2">
                <span><span className="font-medium">{c.section_title}</span> <span className="text-muted-foreground">· {c.item.title}</span></span>
                <span className="shrink-0 text-muted-foreground">{formatDate(c.completed_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {library.length ? (
        <section aria-labelledby="purchased">
          <div className="mb-4 flex items-end justify-between">
            <h2 id="purchased" className="text-xl font-semibold">Your library</h2>
            <Link href="/library" className="text-sm text-accent hover:underline">View all</Link>
          </div>
          <ContentGrid items={library.slice(0, 4).map((l) => l.item)} />
        </section>
      ) : null}

      {bookmarks.length ? (
        <section aria-labelledby="bm">
          <div className="mb-4 flex items-end justify-between">
            <h2 id="bm" className="text-xl font-semibold">Bookmarked topics</h2>
            <Link href="/bookmarks" className="text-sm text-accent hover:underline">View all</Link>
          </div>
          <ul className="flex flex-col gap-2 text-sm">
            {bookmarks.slice(0, 5).map((b) => (
              <li key={b.id}><Link href={`/reader/${b.item.slug}`} className="hover:text-accent"><BookOpen className="mr-2 inline size-3.5" />{b.section_title ?? b.section_id} <span className="text-muted-foreground">· {b.item.title}</span></Link></li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="account-status" className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[var(--radius-lg)] border border-border p-5">
          <h2 id="account-status" className="font-semibold">Recent orders</h2>
          {orders.length ? (
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {orders.slice(0, 3).map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-2">
                  <Link href={`/orders/${o.id}`} className="truncate hover:text-accent">{o.order_items[0]?.product_title_snapshot ?? "Order"}</Link>
                  <span className="flex shrink-0 items-center gap-2"><span className="tabular-nums">{formatMoney(o.amount_minor_units, o.currency)}</span><StatusBadge status={o.payment_status} /></span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-sm text-muted-foreground">No orders yet.</p>}
        </div>
        <div className="rounded-[var(--radius-lg)] border border-border p-5">
          <h2 className="font-semibold">Subscription</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {subscriptionIsActive(subscription)
              ? `${subscription!.plans?.name ?? "Subscription"} active until ${formatDate(subscription!.current_period_end)}${subscription!.cancel_at_period_end ? " (will not renew)" : ""}.`
              : "You do not have an active subscription. Free notes and purchased titles are always available."}
          </p>
          <Link href="/subscription" className="mt-3 inline-block text-sm text-accent hover:underline">Manage</Link>
        </div>
      </section>

      <section aria-labelledby="free">
        <h2 id="free" className="mb-4 text-xl font-semibold">Recommended free notes</h2>
        <ContentGrid items={freeNotes.items} />
      </section>
      <section aria-labelledby="new">
        <h2 id="new" className="mb-4 text-xl font-semibold">Recently published</h2>
        <ContentGrid items={recent.items} />
      </section>
    </div>
  );
}
