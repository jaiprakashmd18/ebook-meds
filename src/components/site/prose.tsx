import { cn } from "@/lib/utils";

/** Long-form typography for static/legal pages. */
export function Prose({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "max-w-[720px] text-[16px] leading-[1.75] text-foreground",
        "[&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight",
        "[&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:font-semibold",
        "[&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:my-1.5 [&_a]:text-accent [&_a]:underline",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function LegalNotice() {
  return (
    <p className="rounded-[var(--radius-md)] border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
      Template text. The operator of this site must review and adapt this page with qualified legal advice for their
      jurisdiction before launch. Items in [brackets] must be completed.
    </p>
  );
}
