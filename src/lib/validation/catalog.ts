import { z } from "zod";
import { CONTENT_TYPES, DIFFICULTIES, type CatalogFilters } from "@/lib/data/types";

const SORTS = ["relevance", "newest", "oldest", "price_asc", "price_desc", "title"] as const;
const DATE_WINDOWS = { "30d": 30, "90d": 90, "365d": 365 } as const;

const filterSchema = z.object({
  q: z.string().trim().max(200).optional().catch(undefined),
  subject: z.string().regex(/^[a-z0-9-]{1,80}$/).optional().catch(undefined),
  topic: z.string().regex(/^[a-z0-9-]{1,80}$/).optional().catch(undefined),
  difficulty: z.enum(DIFFICULTIES).optional().catch(undefined),
  type: z.enum(CONTENT_TYPES).optional().catch(undefined),
  price: z.enum(["free", "paid"]).optional().catch(undefined),
  published: z.enum(["30d", "90d", "365d"]).optional().catch(undefined),
  sort: z.enum(SORTS).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).optional().catch(undefined),
});

export type RawSearchParams = Record<string, string | string[] | undefined>;

/** Parse untrusted query-string values into safe catalog filters. Invalid values are dropped. */
export function parseCatalogParams(raw: RawSearchParams, now = new Date()): {
  filters: CatalogFilters;
  params: Record<string, string | undefined>;
} {
  const flat = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]).filter(([, v]) => v !== "" && v !== undefined),
  );
  const p = filterSchema.parse(flat);
  const publishedAfter = p.published
    ? new Date(now.getTime() - DATE_WINDOWS[p.published] * 86_400_000).toISOString()
    : undefined;
  return {
    filters: {
      q: p.q || undefined,
      subject: p.subject,
      topic: p.topic,
      difficulty: p.difficulty,
      type: p.type,
      price: p.price,
      publishedAfter,
      sort: p.sort,
      page: p.page,
    },
    params: {
      q: p.q || undefined,
      subject: p.subject,
      topic: p.topic,
      difficulty: p.difficulty,
      type: p.type,
      price: p.price,
      published: p.published,
      sort: p.sort,
    },
  };
}
