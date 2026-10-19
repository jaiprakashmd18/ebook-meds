import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";
import { listPublishedForSitemap, listSubjects } from "@/lib/data/catalog";

const STATIC = ["", "/explore", "/subjects", "/pricing", "/about", "/contact", "/privacy", "/terms", "/refund-policy"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv.siteUrl;
  try {
    const [items, subjects] = await Promise.all([listPublishedForSitemap(), listSubjects()]);
    return [
      ...STATIC.map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly" as const })),
      ...subjects.map((s) => ({ url: `${base}/subjects/${s.slug}`, changeFrequency: "weekly" as const })),
      ...items.map((i) => ({ url: `${base}/notes/${i.slug}`, lastModified: i.updated_at, changeFrequency: "monthly" as const })),
    ];
  } catch {
    return STATIC.map((p) => ({ url: `${base}${p}` }));
  }
}
