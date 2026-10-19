import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { CatalogItem } from "@/lib/data/types";
import { ContentGrid } from "./content-card";

export function SectionRow({
  title,
  description,
  href,
  items,
}: {
  title: string;
  description?: string;
  href?: string;
  items: CatalogItem[];
}) {
  if (!items.length) return null;
  return (
    <section className="py-12" aria-labelledby={`row-${title}`}>
      <div className="mb-7 flex items-end justify-between gap-4">
        <div>
          <h2 id={`row-${title}`} className="text-2xl font-semibold tracking-tight">{title}</h2>
          {description ? <p className="mt-1 text-[15px] text-muted-foreground">{description}</p> : null}
        </div>
        {href ? (
          <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-sm text-accent hover:underline">
            See all <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        ) : null}
      </div>
      <ContentGrid items={items} />
    </section>
  );
}
