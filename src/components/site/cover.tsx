import Image from "next/image";
import { CONTENT_TYPE_LABELS, type CatalogItem } from "@/lib/data/types";
import { cn } from "@/lib/utils";

const PALETTES: Record<string, { bg: string; ink: string; line: string }> = {
  anatomy: { bg: "#F4ECE6", ink: "#7A3E2E", line: "#E3D2C6" },
  histology: { bg: "#F1ECF6", ink: "#5B3F86", line: "#DFD4EC" },
  biochemistry: { bg: "#EAF3EE", ink: "#235C41", line: "#D2E6DA" },
  "cell-biology": { bg: "#EAF1FB", ink: "#1F4E8C", line: "#D3E2F5" },
  biophysics: { bg: "#F3F1E8", ink: "#5E5320", line: "#E4DFC9" },
  "medical-imaging": { bg: "#ECEFF2", ink: "#2F3E4C", line: "#D8DEE4" },
  "molecular-biology": { bg: "#F7EDF0", ink: "#86334C", line: "#EBD5DC" },
  physiology: { bg: "#EAF4F6", ink: "#1E5C69", line: "#D2E7EB" },
};
const DEFAULT_PALETTE = { bg: "#F5F5F7", ink: "#1D1D1F", line: "#E5E5EA" };

export function paletteFor(subjectSlug?: string | null) {
  return (subjectSlug && PALETTES[subjectSlug]) || DEFAULT_PALETTE;
}

/**
 * Product cover. Uses the uploaded cover image when there is one; otherwise
 * renders a typographic cover so every product looks finished.
 */
export function Cover({
  item,
  className,
  size = "md",
  priority,
}: {
  item: Pick<CatalogItem, "title" | "cover_image" | "content_type" | "subject">;
  className?: string;
  size?: "sm" | "md" | "lg";
  priority?: boolean;
}) {
  if (item.cover_image) {
    return (
      <div className={cn("relative aspect-[3/4] overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface", className)}>
        <Image
          src={item.cover_image}
          alt={`Cover of ${item.title}`}
          fill
          sizes={size === "lg" ? "(min-width: 768px) 360px, 80vw" : "(min-width: 768px) 240px, 45vw"}
          className="object-cover"
          priority={priority}
        />
      </div>
    );
  }
  const p = paletteFor(item.subject?.slug);
  return (
    <div
      role="img"
      aria-label={`Cover of ${item.title}`}
      className={cn("relative flex aspect-[3/4] flex-col justify-between overflow-hidden rounded-[var(--radius-md)] border", className)}
      style={{ background: p.bg, color: p.ink, borderColor: p.line }}
    >
      <div className={cn("flex items-center justify-between", size === "sm" ? "p-3" : "p-5")}>
        <span className={cn("font-semibold tracking-[0.14em] uppercase", size === "sm" ? "text-[9px]" : "text-[11px]")}>
          {item.subject?.name ?? "StudySimplify"}
        </span>
        <span aria-hidden className="block h-px w-8" style={{ background: p.ink, opacity: 0.35 }} />
      </div>
      <div className={cn(size === "sm" ? "px-3" : "px-5")}>
        <p
          className={cn(
            "font-serif leading-[1.12] font-semibold tracking-tight text-balance",
            size === "sm" ? "text-[15px]" : size === "lg" ? "text-[30px]" : "text-[22px]",
          )}
        >
          {item.title}
        </p>
      </div>
      <div
        className={cn("flex items-center justify-between border-t", size === "sm" ? "px-3 py-2 text-[9px]" : "px-5 py-3 text-[11px]")}
        style={{ borderColor: p.line }}
      >
        <span className="font-medium">StudySimplify</span>
        <span className="opacity-75">{CONTENT_TYPE_LABELS[item.content_type]}</span>
      </div>
    </div>
  );
}
