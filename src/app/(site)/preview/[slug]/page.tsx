import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getItemBySlug } from "@/lib/data/catalog";
import { getReadableContent } from "@/lib/access/content";
import { recordMetric } from "@/lib/data/metrics";
import { Container } from "@/components/ui/misc";
import { DocumentIntro, SectionView } from "@/components/content/blocks";
import { Paywall } from "@/components/site/paywall";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const item = await getItemBySlug((await params).slug);
  if (!item) return { title: "Not found" };
  return {
    title: `Free preview: ${item.title}`,
    description: item.description.slice(0, 160),
    alternates: { canonical: `/notes/${item.slug}` },
  };
}

export default async function PreviewPage({ params }: Props) {
  const { slug } = await params;
  const item = await getItemBySlug(slug);
  if (!item || item.content_type === "bundle") notFound();
  const readable = await getReadableContent(item);
  // Free items and owners go straight to the full reader.
  if (readable.access.granted) redirect(`/reader/${item.slug}`);
  if (!readable.content) notFound();
  await recordMetric(item.id, "preview_views");
  const locked = readable.outline.filter((s) => !s.preview).map((s) => s.title);

  return (
    <div data-reader-theme="light" className="bg-[var(--reader-bg)] text-[var(--reader-fg)]">
      <Container className="max-w-[760px] py-12">
        <p className="text-sm font-medium text-accent">Free preview</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{item.title}</h1>
        {readable.content.subtitle ? <p className="mt-2 text-lg text-[var(--reader-muted)]">{readable.content.subtitle}</p> : null}
        <p className="mt-3 text-sm text-[var(--reader-muted)]">
          Showing {readable.content.sections.length} of {readable.totalSections} sections ·{" "}
          <Link href={`/notes/${item.slug}`} className="text-accent hover:underline">About this title</Link>
        </p>
        <div className="prose-study mt-10 flex flex-col gap-12">
          <DocumentIntro doc={readable.content} />
          {readable.content.sections.map((s) => <SectionView key={s.id} section={s} />)}
        </div>
        <Paywall item={item} access={readable.access} lockedSections={locked} />
      </Container>
    </div>
  );
}
