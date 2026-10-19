import Link from "next/link";
import { Clock, Star } from "lucide-react";
import { CONTENT_TYPE_LABELS, DIFFICULTY_LABELS, type CatalogItem } from "@/lib/data/types";
import { formatReadingTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Cover } from "./cover";
import { PriceTag } from "./price";

export function ContentCard({ item, priority }: { item: CatalogItem; priority?: boolean }) {
  return (
    <Link
      href={`/notes/${item.slug}`}
      className="group flex flex-col gap-3 rounded-[var(--radius-lg)] focus-visible:outline-offset-4"
    >
      <Cover item={item} priority={priority} className="transition-shadow duration-300 group-hover:shadow-md" />
      <div className="flex flex-col gap-1.5 px-0.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{item.subject?.name}</span>
          <span aria-hidden>·</span>
          <span>{CONTENT_TYPE_LABELS[item.content_type]}</span>
        </div>
        <h3 className="text-[15px] leading-snug font-semibold tracking-tight text-pretty group-hover:text-accent">
          {item.title}
        </h3>
        <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{item.description}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
          <Badge tone="outline">{DIFFICULTY_LABELS[item.difficulty]}</Badge>
          {item.content_type !== "bundle" ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" aria-hidden />
              {formatReadingTime(item.estimated_reading_minutes)}
            </span>
          ) : (
            <span>{item.bundle_item_ids?.length ?? 0} titles</span>
          )}
          {item.rating_count > 0 && item.rating_average !== null ? (
            <span className="inline-flex items-center gap-1" aria-label={`Rated ${item.rating_average} out of 5 from ${item.rating_count} reviews`}>
              <Star className="size-3.5 fill-current text-warning" aria-hidden />
              {item.rating_average.toFixed(1)} ({item.rating_count})
            </span>
          ) : null}
          <span className="ml-auto">
            <PriceTag isFree={item.is_free} amount={item.price_minor_units} currency={item.currency} />
          </span>
        </div>
      </div>
    </Link>
  );
}

export function ContentGrid({ items, priorityCount = 0 }: { items: CatalogItem[]; priorityCount?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item, i) => (
        <ContentCard key={item.id} item={item} priority={i < priorityCount} />
      ))}
    </div>
  );
}
