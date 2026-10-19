import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { listSubjects, searchCatalog } from "@/lib/data/catalog";
import { parseCatalogParams, type RawSearchParams } from "@/lib/validation/catalog";
import { getCurrentUser } from "@/lib/auth/session";
import { getSearchHistory, recordSearch } from "@/lib/data/search-history";
import { Container, EmptyState } from "@/components/ui/misc";
import { ContentGrid } from "@/components/site/content-card";
import { CatalogFilterBar } from "@/components/site/catalog-filters";
import { SearchBox } from "@/components/site/search-box";
import { Pagination } from "@/components/ui/pagination";
import { pluralize } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Search",
  robots: { index: false, follow: true },
};

export default async function SearchPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const { filters, params } = parseCatalogParams(await searchParams);
  const user = await getCurrentUser();
  const [result, subjects, history] = await Promise.all([
    params.q || Object.values(params).some(Boolean) ? searchCatalog(filters) : null,
    listSubjects(),
    getSearchHistory(user),
  ]);
  if (result && params.q && (filters.page ?? 1) === 1) await recordSearch(user, params.q, result.total);

  return (
    <Container className="py-14">
      <h1 className="mb-6 text-3xl font-semibold tracking-tight">Search</h1>
      <div className="max-w-2xl">
        <SearchBox initial={params.q ?? ""} history={history} />
      </div>
      <div className="mt-8">
        <CatalogFilterBar params={params} subjects={subjects.map((s) => ({ value: s.slug, label: s.name }))} showRelevance />
      </div>
      {result ? (
        <>
          <p className="mt-6 mb-6 text-sm text-muted-foreground" aria-live="polite">
            {pluralize(result.total, "result")}{params.q ? <> for “{params.q}”</> : null}
          </p>
          {result.items.length ? (
            <ContentGrid items={result.items} />
          ) : (
            <EmptyState
              icon={<SearchX />}
              title="No results"
              description="Check the spelling, try a broader term, or browse by subject."
              action={<Link href="/subjects" className="text-sm text-accent hover:underline">Browse subjects</Link>}
            />
          )}
          <Pagination page={result.page} pageCount={result.pageCount} basePath="/search" params={params} />
        </>
      ) : (
        <p className="mt-10 text-muted-foreground">Search across titles, descriptions, subjects, topics, tags and authors.</p>
      )}
    </Container>
  );
}
