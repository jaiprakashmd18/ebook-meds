import type { Metadata } from "next";
import { SearchX } from "lucide-react";
import { listSubjects, searchCatalog } from "@/lib/data/catalog";
import { parseCatalogParams, type RawSearchParams } from "@/lib/validation/catalog";
import { Container, EmptyState, PageHeader } from "@/components/ui/misc";
import { ContentGrid } from "@/components/site/content-card";
import { CatalogFilterBar } from "@/components/site/catalog-filters";
import { Pagination } from "@/components/ui/pagination";
import { pluralize } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Explore study notes",
  description: "Browse structured study notes, ebooks, revision sheets and practice questions for medical students.",
  alternates: { canonical: "/explore" },
};

export default async function ExplorePage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const { filters, params } = parseCatalogParams(await searchParams);
  const [result, subjects] = await Promise.all([searchCatalog(filters), listSubjects()]);
  return (
    <Container className="py-14">
      <PageHeader
        eyebrow="Explore"
        title={params.price === "free" ? "Free study notes" : "All study notes"}
        description="Structured notes, ebooks, revision sheets and practice questions."
      />
      <CatalogFilterBar params={params} subjects={subjects.map((s) => ({ value: s.slug, label: s.name }))} />
      <p className="mt-6 mb-6 text-sm text-muted-foreground" aria-live="polite">{pluralize(result.total, "result")}</p>
      {result.items.length ? (
        <ContentGrid items={result.items} priorityCount={4} />
      ) : (
        <EmptyState icon={<SearchX />} title="Nothing matches these filters" description="Try removing a filter or browsing all subjects." />
      )}
      <Pagination page={result.page} pageCount={result.pageCount} basePath="/explore" params={params} />
    </Container>
  );
}
