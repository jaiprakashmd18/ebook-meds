"use client";

import { useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";
import { Loader2, X } from "lucide-react";
import { CONTENT_TYPE_LABELS, DIFFICULTY_LABELS, CONTENT_TYPES, DIFFICULTIES } from "@/lib/data/types";
import { Select, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Option = { value: string; label: string };

export function CatalogFilterBar({
  params,
  subjects,
  topics,
  hideSubject,
  showRelevance,
}: {
  params: Record<string, string | undefined>;
  subjects: Option[];
  topics?: Option[];
  hideSubject?: boolean;
  showRelevance?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const update = (key: string, value: string) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params, [key]: value })) {
      if (v && k !== "page") sp.set(k, v);
    }
    if (key === "subject") sp.delete("topic");
    startTransition(() => router.push(`${pathname}${sp.size ? `?${sp}` : ""}`, { scroll: false }));
  };

  const active = Object.entries(params).filter(([k, v]) => v && k !== "q" && k !== "sort");
  const field = "flex min-w-36 flex-1 flex-col gap-1";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3" role="group" aria-label="Filter results">
        {!hideSubject ? (
          <div className={field}>
            <Label htmlFor="f-subject" className="text-xs text-muted-foreground">Subject</Label>
            <Select id="f-subject" value={params.subject ?? ""} onChange={(e) => update("subject", e.target.value)} className="h-10 text-sm">
              <option value="">All subjects</option>
              {subjects.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </div>
        ) : null}
        {topics && topics.length ? (
          <div className={field}>
            <Label htmlFor="f-topic" className="text-xs text-muted-foreground">Topic</Label>
            <Select id="f-topic" value={params.topic ?? ""} onChange={(e) => update("topic", e.target.value)} className="h-10 text-sm">
              <option value="">All topics</option>
              {topics.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </div>
        ) : null}
        <div className={field}>
          <Label htmlFor="f-difficulty" className="text-xs text-muted-foreground">Difficulty</Label>
          <Select id="f-difficulty" value={params.difficulty ?? ""} onChange={(e) => update("difficulty", e.target.value)} className="h-10 text-sm">
            <option value="">Any level</option>
            {DIFFICULTIES.map((d) => <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}
          </Select>
        </div>
        <div className={field}>
          <Label htmlFor="f-type" className="text-xs text-muted-foreground">Content type</Label>
          <Select id="f-type" value={params.type ?? ""} onChange={(e) => update("type", e.target.value)} className="h-10 text-sm">
            <option value="">All types</option>
            {CONTENT_TYPES.map((t) => <option key={t} value={t}>{CONTENT_TYPE_LABELS[t]}</option>)}
          </Select>
        </div>
        <div className={field}>
          <Label htmlFor="f-price" className="text-xs text-muted-foreground">Price</Label>
          <Select id="f-price" value={params.price ?? ""} onChange={(e) => update("price", e.target.value)} className="h-10 text-sm">
            <option value="">Free and paid</option>
            <option value="free">Free</option>
            <option value="paid">Paid</option>
          </Select>
        </div>
        <div className={field}>
          <Label htmlFor="f-published" className="text-xs text-muted-foreground">Published</Label>
          <Select id="f-published" value={params.published ?? ""} onChange={(e) => update("published", e.target.value)} className="h-10 text-sm">
            <option value="">Any time</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 3 months</option>
            <option value="365d">Last year</option>
          </Select>
        </div>
        <div className={field}>
          <Label htmlFor="f-sort" className="text-xs text-muted-foreground">Sort by</Label>
          <Select id="f-sort" value={params.sort ?? ""} onChange={(e) => update("sort", e.target.value)} className="h-10 text-sm">
            <option value="">{showRelevance ? "Best match" : "Newest"}</option>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="title">Title A–Z</option>
          </Select>
        </div>
      </div>
      <div className="flex min-h-8 items-center gap-2" aria-live="polite">
        {pending ? <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Updating results" /> : null}
        {active.length ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              startTransition(() => router.push(params.q ? `${pathname}?q=${encodeURIComponent(params.q)}` : pathname, { scroll: false }))
            }
          >
            <X /> Clear filters
          </Button>
        ) : null}
      </div>
    </div>
  );
}
