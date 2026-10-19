import type { CatalogFilters, CatalogItem, Paginated } from "./types";

function tokens(q: string): string[] {
  return q
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s+-]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function score(item: CatalogItem, terms: string[]): number {
  if (!terms.length) return 0;
  const strong = [item.title, ...item.tags].join(" ").toLowerCase();
  const weak = [item.subtitle ?? "", item.description, item.subject?.name ?? "", item.topic?.name ?? "", item.byline ?? ""]
    .join(" ")
    .toLowerCase();
  let s = 0;
  for (const t of terms) {
    if (strong.includes(t)) s += 3;
    else if (weak.includes(t)) s += 1;
    else return 0; // every term must match somewhere (AND semantics, like websearch)
  }
  return s;
}

/** In-memory equivalent of the `search_catalog` SQL function, for demo mode and tests. */
export function searchFixtures(
  all: CatalogItem[],
  filters: CatalogFilters,
  page: number,
  pageSize: number,
): Paginated<CatalogItem> {
  const terms = tokens(filters.q ?? "");
  let rows = all
    .filter((i) => i.publication_status === "published")
    .filter((i) => !filters.subject || i.subject?.slug === filters.subject)
    .filter((i) => !filters.topic || i.topic?.slug === filters.topic)
    .filter((i) => !filters.difficulty || i.difficulty === filters.difficulty)
    .filter((i) => !filters.type || i.content_type === filters.type)
    .filter((i) => !filters.price || (filters.price === "free" ? i.is_free : !i.is_free))
    .filter((i) => !filters.publishedAfter || (i.published_at ?? "") >= filters.publishedAfter)
    .map((i) => ({ i, s: score(i, terms) }))
    .filter(({ s }) => !terms.length || s > 0);

  const sort = filters.sort ?? (terms.length ? "relevance" : "newest");
  rows = rows.sort((a, b) => {
    switch (sort) {
      case "relevance":
        return b.s - a.s || (b.i.published_at ?? "").localeCompare(a.i.published_at ?? "");
      case "oldest":
        return (a.i.published_at ?? "").localeCompare(b.i.published_at ?? "");
      case "price_asc":
        return a.i.price_minor_units - b.i.price_minor_units;
      case "price_desc":
        return b.i.price_minor_units - a.i.price_minor_units;
      case "title":
        return a.i.title.localeCompare(b.i.title);
      default:
        return (b.i.published_at ?? "").localeCompare(a.i.published_at ?? "");
    }
  });

  const total = rows.length;
  const start = (page - 1) * pageSize;
  return {
    items: rows.slice(start, start + pageSize).map((r) => r.i),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}
