import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, FileText, Lock, ShieldAlert, ShieldCheck, Star } from "lucide-react";
import { getBundlesContaining, getItemBySlug, getItemsByIds } from "@/lib/data/catalog";
import { getReadableContent, resolveAccess } from "@/lib/access/content";
import { getApprovedReviews, getMyReviewState } from "@/lib/data/reviews";
import { getCurrentUser } from "@/lib/auth/session";
import { recordMetric } from "@/lib/data/metrics";
import { CONTENT_TYPE_LABELS, DIFFICULTY_LABELS } from "@/lib/data/types";
import { formatDate, formatReadingTime } from "@/lib/utils";
import { publicEnv } from "@/lib/env";
import { minorToMajorString } from "@/lib/money";
import { Container } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Cover } from "@/components/site/cover";
import { PurchasePanel } from "@/components/site/purchase-panel";
import { ContentGrid } from "@/components/site/content-card";
import { ReportDialog, ReviewForm } from "@/components/site/feedback-forms";
import { Inline } from "@/components/content/inline";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const item = await getItemBySlug((await params).slug);
  if (!item) return { title: "Not found", robots: { index: false } };
  return {
    title: item.title,
    description: item.description.slice(0, 160),
    alternates: { canonical: `/notes/${item.slug}` },
    openGraph: { type: "article", title: item.title, description: item.description, url: `/notes/${item.slug}` },
  };
}

export default async function NotePage({ params }: Props) {
  const { slug } = await params;
  const item = await getItemBySlug(slug);
  if (!item) notFound();
  const user = await getCurrentUser();
  const isBundle = item.content_type === "bundle";
  const [readable, reviews, reviewState, bundleItems, bundles] = await Promise.all([
    isBundle ? null : getReadableContent(item),
    getApprovedReviews(item.id),
    getMyReviewState(user, item),
    isBundle ? getItemsByIds(item.bundle_item_ids ?? []) : [],
    isBundle ? [] : getBundlesContaining(item.id),
  ]);
  await recordMetric(item.id, "product_views");
  const accessDecision = readable?.access ?? (await resolveAccess(item));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": isBundle ? "Product" : "Book",
    name: item.title,
    description: item.description,
    url: `${publicEnv.siteUrl}/notes/${item.slug}`,
    inLanguage: "en",
    ...(isBundle ? {} : { bookFormat: "https://schema.org/EBook", educationalLevel: DIFFICULTY_LABELS[item.difficulty], about: item.subject?.name }),
    ...(item.published_at ? { datePublished: item.published_at } : {}),
    dateModified: item.updated_at,
    offers: {
      "@type": "Offer",
      price: minorToMajorString(item.price_minor_units, item.currency),
      priceCurrency: item.currency,
      availability: "https://schema.org/InStock",
    },
    ...(item.rating_count > 0 && item.rating_average !== null
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: item.rating_average, reviewCount: item.rating_count } }
      : {}),
  };

  return (
    <Container className="py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <nav aria-label="Breadcrumb" className="mb-8 text-sm text-muted-foreground">
        <Link href="/subjects" className="hover:text-foreground">Subjects</Link> <span aria-hidden>/</span>{" "}
        {item.subject ? <Link href={`/subjects/${item.subject.slug}`} className="hover:text-foreground">{item.subject.name}</Link> : null}
      </nav>

      <div className="grid gap-10 lg:grid-cols-[300px_1fr_320px]">
        <div className="mx-auto w-full max-w-[300px]">
          <Cover item={item} size="lg" priority />
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{CONTENT_TYPE_LABELS[item.content_type]}</Badge>
            <Badge tone="outline">{DIFFICULTY_LABELS[item.difficulty]}</Badge>
            {item.is_free ? <Badge tone="success">Free</Badge> : null}
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{item.title}</h1>
            {item.subtitle ? <p className="mt-2 text-lg text-muted-foreground">{item.subtitle}</p> : null}
          </div>
          <p className="text-[17px] leading-relaxed">{item.description}</p>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-[var(--radius-lg)] bg-surface p-5 text-sm sm:grid-cols-3">
            {!isBundle ? (
              <div>
                <dt className="text-muted-foreground">Reading time</dt>
                <dd className="mt-0.5 flex items-center gap-1 font-medium"><Clock className="size-3.5" aria-hidden /> {formatReadingTime(item.estimated_reading_minutes)}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-muted-foreground">Subject</dt>
              <dd className="mt-0.5 font-medium">{item.subject?.name}{item.topic ? ` · ${item.topic.name}` : ""}</dd>
            </div>
            {item.version_number ? (
              <div>
                <dt className="text-muted-foreground">Version</dt>
                <dd className="mt-0.5 font-medium">v{item.version_number}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-muted-foreground">Last updated</dt>
              <dd className="mt-0.5 font-medium">{formatDate(item.updated_at)}</dd>
            </div>
            {item.byline ? (
              <div>
                <dt className="text-muted-foreground">Author</dt>
                <dd className="mt-0.5 font-medium">{item.byline}</dd>
              </div>
            ) : null}
            {!isBundle ? (
              <div>
                <dt className="text-muted-foreground">PDF</dt>
                <dd className="mt-0.5 font-medium">{item.pdf_downloadable ? (item.has_pdf ? "Included" : "In preparation") : "Online only"}</dd>
              </div>
            ) : null}
          </dl>

          <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-border p-4 text-sm">
            {item.reviewer_name && item.reviewed_at ? (
              <>
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                <p>Reviewed by <strong>{item.reviewer_name}</strong> on {formatDate(item.reviewed_at)}.</p>
              </>
            ) : (
              <>
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                <p className="text-muted-foreground">
                  This title has not yet been independently reviewed by a subject expert. If you spot an error, please report it.
                </p>
              </>
            )}
          </div>

          {item.learning_objectives.length ? (
            <section aria-labelledby="objectives">
              <h2 id="objectives" className="text-lg font-semibold">What you will learn</h2>
              <ul className="mt-3 flex flex-col gap-2">
                {item.learning_objectives.map((o, i) => (
                  <li key={i} className="flex gap-2.5 text-[15px]">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden /> <span><Inline text={o} /></span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {readable?.outline.length ? (
            <section aria-labelledby="included">
              <h2 id="included" className="text-lg font-semibold">What is included</h2>
              <ol className="mt-3 divide-y divide-border overflow-hidden rounded-[var(--radius-md)] border border-border">
                {readable.outline.map((s, i) => (
                  <li key={s.id} className="flex items-center gap-3 px-4 py-3 text-[15px]">
                    <span className="w-6 text-sm text-muted-foreground tabular-nums">{i + 1}</span>
                    <span className="flex-1">{s.title}</span>
                    {readable.access.granted ? null : s.preview ? (
                      <Badge tone="success">Free preview</Badge>
                    ) : (
                      <Lock className="size-3.5 text-muted-foreground" aria-label="Unlocks after purchase" />
                    )}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {isBundle ? (
            <section aria-labelledby="bundle-items">
              <h2 id="bundle-items" className="mb-5 text-lg font-semibold">Included in this bundle</h2>
              <ContentGrid items={bundleItems} />
            </section>
          ) : null}

          {item.tags.length ? (
            <ul className="flex flex-wrap gap-2" aria-label="Tags">
              {item.tags.map((t) => (
                <li key={t}><Link href={`/search?q=${encodeURIComponent(t)}`} className="rounded-full bg-surface px-3 py-1 text-xs text-muted-foreground hover:text-foreground">#{t}</Link></li>
              ))}
            </ul>
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-[var(--radius-xl)] border border-border p-6 shadow-sm">
            <PurchasePanel item={item} access={accessDecision} />
          </div>
          {!isBundle ? (
            <div className="mt-3 flex justify-center">
              {user ? <ReportDialog contentItemId={item.id} /> : (
                <Link href={`/auth/login?next=/notes/${item.slug}`} className="text-sm text-muted-foreground hover:text-foreground">Sign in to report an error</Link>
              )}
            </div>
          ) : null}
        </aside>
      </div>

      {bundles.length ? (
        <section className="mt-16" aria-labelledby="bundles">
          <h2 id="bundles" className="mb-6 text-xl font-semibold">Save with a bundle</h2>
          <ContentGrid items={bundles} />
        </section>
      ) : null}

      <section className="mt-16 max-w-3xl" aria-labelledby="reviews">
        <h2 id="reviews" className="flex items-center gap-2 text-xl font-semibold">
          Reviews
          {item.rating_count > 0 && item.rating_average !== null ? (
            <span className="flex items-center gap-1 text-base font-normal text-muted-foreground">
              <Star className="size-4 fill-warning text-warning" aria-hidden /> {item.rating_average.toFixed(1)} from {item.rating_count}
            </span>
          ) : null}
        </h2>
        {reviews.length ? (
          <ul className="mt-5 flex flex-col gap-4">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-[var(--radius-md)] border border-border p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-0.5" aria-label={`${r.rating} out of 5`}>
                    {[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`size-3.5 ${n <= r.rating ? "fill-warning text-warning" : "text-border-strong"}`} aria-hidden />)}
                  </span>
                  <span className="text-xs text-muted-foreground">{r.author} · {formatDate(r.created_at)}</span>
                </div>
                {r.review_text ? <p className="mt-2 text-[15px]">{r.review_text}</p> : null}
                {user ? (
                  <div className="mt-2">
                    <ReportDialog contentItemId={item.id} reviewId={r.id} trigger={<button className="text-xs text-muted-foreground hover:text-foreground">Report review</button>} />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[15px] text-muted-foreground">No reviews yet.</p>
        )}
        <div className="mt-6">
          {reviewState.kind === "eligible" ? (
            <div className="rounded-[var(--radius-lg)] border border-border p-5">
              <h3 className="mb-4 font-semibold">Write a review</h3>
              <ReviewForm contentItemId={item.id} slug={item.slug} />
            </div>
          ) : reviewState.kind === "reviewed" ? (
            <p className="text-sm text-muted-foreground">
              <FileText className="mr-1 inline size-4" aria-hidden />
              You rated this {reviewState.rating}/5
              {reviewState.moderation_status === "pending" ? " — awaiting moderation." : reviewState.moderation_status === "approved" ? "." : ` — ${reviewState.moderation_status}.`}
            </p>
          ) : reviewState.kind === "not_eligible" ? (
            <p className="text-sm text-muted-foreground">Reviews are open to readers who own{item.is_free ? " or have read" : ""} this title.</p>
          ) : null}
        </div>
      </section>
    </Container>
  );
}
