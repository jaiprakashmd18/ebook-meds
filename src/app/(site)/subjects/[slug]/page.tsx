import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen } from "lucide-react";
import { getSubjectBySlug, listSubjects, searchCatalog } from "@/lib/data/catalog";
import { parseCatalogParams, type RawSearchParams } from "@/lib/validation/catalog";
import { Container, EmptyState } from "@/components/ui/misc";
import { ContentGrid } from "@/components/site/content-card";
import { CatalogFilterBar } from "@/components/site/catalog-filters";
import { Pagination } from "@/components/ui/pagination";
import { SectionRow } from "@/components/site/section-row";
import { paletteFor } from "@/components/site/cover";
import { DIFFICULTY_LABELS, DIFFICULTIES } from "@/lib/data/types";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<RawSearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const subject = await getSubjectBySlug((await params).slug);
  if (!subject) return { title: "Subject not found" };
  return {
    title: `${subject.name} notes`,
    description: subject.description.slice(0, 160),
    alternates: { canonical: `/subjects/${subject.slug}` },
    openGraph: { title: `${subject.name} study notes`, description: subject.description },
  };
}

export default async function SubjectPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const subject = await getSubjectBySlug(slug);
  if (!subject) notFound();
  const { filters, params: qp } = parseCatalogParams(await searchParams);
  const hasFilters = Object.values(qp).some(Boolean);
  const [all, free, paid, bundles, path, subjects] = await Promise.all([
    searchCatalog({ ...filters, subject: subject.slug }),
    hasFilters ? null : searchCatalog({ subject: subject.slug, price: "free", pageSize: 4 }),
    hasFilters ? null : searchCatalog({ subject: subject.slug, price: "paid", pageSize: 4 }),
    hasFilters ? null : searchCatalog({ subject: subject.slug, type: "bundle", pageSize: 4 }),
    hasFilters ? null : searchCatalog({ subject: subject.slug, sort: "oldest", pageSize: 48 }),
    listSubjects(),
  ]);
  const p = paletteFor(subject.slug);
  const learningPath = path
    ? DIFFICULTIES.map((d) => ({ d, items: path.items.filter((i) => i.difficulty === d && i.content_type !== "bundle") })).filter((x) => x.items.length)
    : [];

  return (
    <>
      <section className="border-b" style={{ background: p.bg, borderColor: p.line, color: p.ink }}>
        <Container className="py-16">
          <nav aria-label="Breadcrumb" className="mb-4 text-sm opacity-80">
            <Link href="/subjects" className="hover:underline">Subjects</Link> <span aria-hidden>/</span> {subject.name}
          </nav>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{subject.name}</h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed opacity-90">{subject.description}</p>
          {subject.topics.length ? (
            <ul className="mt-6 flex flex-wrap gap-2" aria-label="Topics">
              {subject.topics.map((t) => (
                <li key={t.id}>
                  <Link href={`/subjects/${subject.slug}?topic=${t.slug}`} className="inline-block rounded-full border px-3 py-1 text-sm hover:bg-white/50" style={{ borderColor: p.line }}>
                    {t.name}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </Container>
      </section>
      <Container className="py-6">
        {learningPath.length ? (
          <section className="py-10" aria-labelledby="path-heading">
            <h2 id="path-heading" className="text-2xl font-semibold tracking-tight">Beginner-friendly learning path</h2>
            <p className="mt-1 text-[15px] text-muted-foreground">Work through the titles in this order, from foundations to detail.</p>
            <ol className="mt-6 grid gap-4 md:grid-cols-3">
              {learningPath.map(({ d, items }, i) => (
                <li key={d} className="rounded-[var(--radius-lg)] border border-border p-5">
                  <p className="text-xs font-semibold tracking-wide text-accent uppercase">Step {i + 1} · {DIFFICULTY_LABELS[d]}</p>
                  <ul className="mt-3 flex flex-col gap-2">
                    {items.map((it) => (
                      <li key={it.id}>
                        <Link href={`/notes/${it.slug}`} className="text-[15px] font-medium hover:text-accent">{it.title}</Link>
                        <span className="ml-2 text-xs text-muted-foreground">{it.is_free ? "Free" : "Paid"}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
        {free ? <SectionRow title="Free resources" items={free.items} href={`/subjects/${subject.slug}?price=free`} /> : null}
        {paid ? <SectionRow title="Paid ebooks and notes" items={paid.items.filter((i) => i.content_type !== "bundle")} href={`/subjects/${subject.slug}?price=paid`} /> : null}
        {bundles ? <SectionRow title="Subject bundles" items={bundles.items} /> : null}

        <section className="py-10" aria-labelledby="all-heading">
          <h2 id="all-heading" className="mb-6 text-2xl font-semibold tracking-tight">All {subject.name} titles</h2>
          <CatalogFilterBar
            params={qp}
            subjects={subjects.map((s) => ({ value: s.slug, label: s.name }))}
            topics={subject.topics.map((t) => ({ value: t.slug, label: t.name }))}
            hideSubject
          />
          <div className="mt-6">
            {all.items.length ? (
              <ContentGrid items={all.items} />
            ) : (
              <EmptyState icon={<BookOpen />} title={hasFilters ? "No titles match these filters" : "Notes for this subject are in preparation"} description={hasFilters ? "Try clearing filters." : "Browse free notes in other subjects in the meantime."} action={<Link href="/explore?price=free" className="text-sm text-accent hover:underline">Browse free notes</Link>} />
            )}
          </div>
          <Pagination page={all.page} pageCount={all.pageCount} basePath={`/subjects/${subject.slug}`} params={qp} />
        </section>
      </Container>
    </>
  );
}
