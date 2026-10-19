import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getItemBySlug } from "@/lib/data/catalog";
import { getReadableContent } from "@/lib/access/content";
import { getCurrentUser } from "@/lib/auth/session";
import { getReaderState } from "@/lib/data/reader-state";
import { recordMetric } from "@/lib/data/metrics";
import { sectionPlainText, type Section } from "@/lib/content/schema";
import { stripInline } from "@/lib/content/inline";
import { DocumentIntro, ReferencesList, SectionView } from "@/components/content/blocks";
import { Reader, type ReaderSection } from "@/components/reader/reader";
import { Paywall } from "@/components/site/paywall";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const item = await getItemBySlug((await params).slug);
  return { title: item ? item.title : "Reader", robots: { index: false, follow: false } };
}

const minutes = (s: Section) => Math.max(1, Math.round(sectionPlainText(s).split(/\s+/).length / 200));

export default async function ReaderPage({ params }: Props) {
  const { slug } = await params;
  const item = await getItemBySlug(slug);
  if (!item || item.content_type === "bundle") notFound();
  const [readable, user] = await Promise.all([getReadableContent(item), getCurrentUser()]);
  if (!readable.content) notFound();
  const state = readable.access.granted ? await getReaderState(user, item.id) : await getReaderState(null, item.id);
  await recordMetric(item.id, readable.access.granted ? "reader_opens" : "preview_views");

  const doc = readable.content;
  const available = new Set(doc.sections.map((s) => s.id));
  const sections: ReaderSection[] = doc.sections.map((s, i) => ({
    id: s.id,
    title: s.title,
    minutes: minutes(s),
    text: stripInline(sectionPlainText(s)),
    node: (
      <>
        {i === 0 ? <div className="mb-12"><DocumentIntro doc={doc} /></div> : null}
        <SectionView section={s} />
        {i === doc.sections.length - 1 && readable.access.granted ? <ReferencesList doc={doc} /> : null}
      </>
    ),
  }));
  const locked = readable.outline.filter((o) => !available.has(o.id)).map((o) => ({ id: o.id, title: o.title }));

  return (
    <Reader
      item={{ id: item.id, slug: item.slug, title: item.title, subtitle: doc.subtitle ?? null, subject: item.subject?.name ?? "", pdf: item.pdf_downloadable && item.has_pdf }}
      versionId={readable.version?.id ?? null}
      versionNumber={readable.version?.version_number ?? null}
      sections={sections}
      lockedSections={locked}
      initialState={state}
      signedIn={Boolean(user)}
      canPersist={Boolean(user) && readable.access.granted}
      isPreview={readable.isPreview}
      paywall={readable.isPreview ? <Paywall item={item} access={readable.access} lockedSections={locked.map((l) => l.title)} /> : null}
    />
  );
}
