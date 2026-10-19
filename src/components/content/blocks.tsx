import { AlertTriangle, BookMarked, Brain, ChevronRight, GraduationCap, Info, Lightbulb, Stethoscope } from "lucide-react";
import type { Block, Section, StructuredContent } from "@/lib/content/schema";
import { DEPTH_LABELS } from "@/lib/content/schema";
import { resolveImageSrc } from "@/lib/content/images";
import { cn } from "@/lib/utils";
import { Inline, renderLatex } from "./inline";
import { McqView } from "./mcq";

const CALLOUTS = {
  note: { Icon: Info, label: "Note", cls: "border-accent/30 bg-accent-soft/60" },
  tip: { Icon: Lightbulb, label: "Tip", cls: "border-success/30 bg-success-soft/60" },
  warning: { Icon: AlertTriangle, label: "Caution", cls: "border-warning/40 bg-warning-soft/70" },
  exam: { Icon: GraduationCap, label: "Exam focus", cls: "border-accent/30 bg-accent-soft/60" },
  clinical: { Icon: Stethoscope, label: "Clinical relevance", cls: "border-[#1E5C69]/30 bg-[#EAF4F6]/70 dark:bg-transparent" },
  mistake: { Icon: AlertTriangle, label: "Common mistake", cls: "border-danger/30 bg-danger-soft/60" },
  mnemonic: { Icon: Brain, label: "Mnemonic", cls: "border-[#5B3F86]/30 bg-[#F1ECF6]/70 dark:bg-transparent" },
} as const;

const muted = "text-[var(--reader-muted,var(--muted-foreground))]";
const border = "border-[var(--reader-border,var(--border))]";

export function BlockView({ block, mcqNumber }: { block: Block; mcqNumber?: number }) {
  switch (block.type) {
    case "heading":
      return block.level === 3 ? (
        <h3 className="mt-8 mb-3 text-[1.15em] font-semibold tracking-tight"><Inline text={block.text} /></h3>
      ) : (
        <h4 className="mt-6 mb-2 font-semibold"><Inline text={block.text} /></h4>
      );
    case "paragraph":
      return <p className="my-4"><Inline text={block.text} /></p>;
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag className={cn("my-4 flex flex-col gap-2 pl-6", block.ordered ? "list-decimal" : "list-disc")}>
          {block.items.map((item, i) => (
            <li key={i} className="pl-1"><Inline text={item} /></li>
          ))}
        </Tag>
      );
    }
    case "table":
      return (
        <figure className="my-6">
          <div className={cn("overflow-x-auto rounded-[var(--radius-md)] border", border)} tabIndex={0} role="region" aria-label={block.caption ?? "Table"}>
            <table className="w-full min-w-[480px] border-collapse text-left text-[0.92em]">
              <thead className="bg-[var(--reader-panel,var(--surface))]">
                <tr>
                  {block.headers.map((h, i) => (
                    <th key={i} scope="col" className={cn("border-b px-4 py-2.5 font-semibold", border)}><Inline text={h} /></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, r) => (
                  <tr key={r} className={cn("border-b last:border-0", border)}>
                    {row.map((cell, c) => (
                      <td key={c} className="px-4 py-2.5 align-top"><Inline text={cell} /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {block.caption ? <figcaption className={cn("mt-2 text-[0.85em]", muted)}><Inline text={block.caption} /></figcaption> : null}
        </figure>
      );
    case "image":
      return (
        <figure className="my-6">
          {/* eslint-disable-next-line @next/next/no-img-element -- author images come from storage with unknown dimensions */}
          <img src={resolveImageSrc(block.src)} alt={block.alt} loading="lazy" className={cn("mx-auto max-h-[520px] w-auto rounded-[var(--radius-md)] border", border)} />
          {block.caption ? <figcaption className={cn("mt-2 text-center text-[0.85em]", muted)}><Inline text={block.caption} /></figcaption> : null}
        </figure>
      );
    case "callout": {
      const c = CALLOUTS[block.variant];
      return (
        <aside className={cn("my-6 rounded-[var(--radius-md)] border-l-[3px] px-5 py-4", c.cls)} aria-label={c.label}>
          <p className="flex items-center gap-2 text-[0.8em] font-semibold tracking-wide uppercase opacity-80">
            <c.Icon className="size-4" aria-hidden /> {c.label}
          </p>
          {block.title ? <p className="mt-1.5 font-semibold"><Inline text={block.title} /></p> : null}
          <p className="mt-1"><Inline text={block.text} /></p>
        </aside>
      );
    }
    case "equation":
      return (
        <figure className="my-6">
          <div
            className="overflow-x-auto py-2 text-center"
            role="math"
            aria-label={block.fallbackText}
            dangerouslySetInnerHTML={{ __html: renderLatex(block.latex, true) }}
          />
          {block.caption ? <figcaption className={cn("mt-1 text-center text-[0.85em]", muted)}><Inline text={block.caption} /></figcaption> : null}
        </figure>
      );
    case "diagram":
      return (
        <figure className={cn("my-6 rounded-[var(--radius-lg)] border p-5", border)}>
          <p className="mb-4 text-[0.8em] font-semibold tracking-wide uppercase opacity-70">{block.title}</p>
          <ol className={cn("flex flex-col gap-2", block.layout === "flow" && "md:flex-row md:flex-wrap md:items-stretch")}>
            {block.steps.map((s, i) => (
              <li key={i} className="flex items-stretch gap-2 md:flex-1 md:basis-40">
                <div className="flex flex-1 flex-col rounded-xl bg-[var(--reader-panel,var(--surface))] px-3.5 py-3">
                  <span className="text-[0.75em] opacity-60">{block.layout === "cycle" ? `${i + 1} →` : i + 1}</span>
                  <span className="font-medium"><Inline text={s.label} /></span>
                  {s.detail ? <span className={cn("mt-0.5 text-[0.85em]", muted)}><Inline text={s.detail} /></span> : null}
                </div>
                {block.layout === "flow" && i < block.steps.length - 1 ? (
                  <ChevronRight className="hidden size-4 shrink-0 self-center opacity-40 md:block" aria-hidden />
                ) : null}
              </li>
            ))}
          </ol>
          {block.caption ? <figcaption className={cn("mt-3 text-[0.85em]", muted)}><Inline text={block.caption} /></figcaption> : null}
        </figure>
      );
    case "mcq":
      return (
        <McqView
          number={mcqNumber}
          question={<Inline text={block.question} />}
          options={block.options.map((o, i) => <Inline key={i} text={o} />)}
          answerIndex={block.answerIndex}
          explanation={<Inline text={block.explanation} />}
        />
      );
    case "definition":
      return (
        <dl className={cn("my-5 rounded-[var(--radius-md)] border px-5 py-4", border)}>
          <dt className="flex items-center gap-2 font-semibold">
            <BookMarked className="size-4 opacity-60" aria-hidden /> <Inline text={block.term} />
          </dt>
          <dd className="mt-1.5"><Inline text={block.definition} /></dd>
          {block.simplified ? (
            <dd className={cn("mt-2 text-[0.92em]", muted)}>
              <span className="font-medium">In simple words: </span><Inline text={block.simplified} />
            </dd>
          ) : null}
        </dl>
      );
    case "expandable":
      return (
        <details className={cn("group my-4 rounded-[var(--radius-md)] border px-5 py-3", border)}>
          <summary className="cursor-pointer list-none font-medium marker:hidden">
            <span className="inline-flex items-center gap-2">
              <ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden />
              <Inline text={block.summary} />
            </span>
          </summary>
          <p className="mt-3"><Inline text={block.text} /></p>
        </details>
      );
    case "explainer":
      return (
        <div className={cn("my-6 grid gap-px overflow-hidden rounded-[var(--radius-md)] border md:grid-cols-2", border)}>
          <div className="bg-[var(--reader-bg,var(--background))] p-4">
            <p className="text-[0.75em] font-semibold tracking-wide uppercase opacity-60">Precise definition</p>
            <p className="mt-1.5"><Inline text={block.technical} /></p>
          </div>
          <div className="bg-[var(--reader-panel,var(--surface))] p-4">
            <p className="text-[0.75em] font-semibold tracking-wide uppercase opacity-60">Simplified</p>
            <p className="mt-1.5"><Inline text={block.simplified} /></p>
          </div>
        </div>
      );
    case "question":
      return (
        <details className={cn("group my-4 rounded-[var(--radius-md)] border px-5 py-3", border)}>
          <summary className="cursor-pointer list-none marker:hidden">
            <span className="text-[0.75em] font-semibold tracking-wide uppercase opacity-60">
              {block.kind === "oral" ? "Viva question" : "Short-answer question"}
            </span>
            <span className="mt-1 block font-medium"><Inline text={block.question} /></span>
            <span className="mt-2 inline-block text-[0.85em] text-accent group-open:hidden">Show answer</span>
          </summary>
          <p className="mt-3"><Inline text={block.answer} /></p>
        </details>
      );
  }
}

export function SectionView({ section, showHeading = true }: { section: Section; showHeading?: boolean }) {
  let mcq = 0;
  return (
    <section id={`section-${section.id}`} data-section-id={section.id} aria-labelledby={`h-${section.id}`} className="scroll-mt-24">
      {showHeading ? (
        <header className="mb-2">
          {section.depth ? (
            <p className="mb-2 text-[0.75em] font-semibold tracking-wide text-accent uppercase">{DEPTH_LABELS[section.depth]}</p>
          ) : null}
          <h2 id={`h-${section.id}`} className="text-[1.5em] leading-tight font-semibold tracking-tight">
            {section.title}
          </h2>
        </header>
      ) : (
        <h2 id={`h-${section.id}`} className="sr-only">{section.title}</h2>
      )}
      <div data-highlight-root>
        {section.blocks.map((b, i) => (
          <BlockView key={i} block={b} mcqNumber={b.type === "mcq" ? ++mcq : undefined} />
        ))}
      </div>
    </section>
  );
}

export function DocumentIntro({ doc }: { doc: StructuredContent }) {
  return (
    <div className="flex flex-col gap-6">
      {doc.learningObjectives.length ? (
        <div className={cn("rounded-[var(--radius-lg)] border p-5", border)}>
          <p className="text-[0.75em] font-semibold tracking-wide uppercase opacity-60">Learning objectives</p>
          <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5">
            {doc.learningObjectives.map((o, i) => <li key={i}><Inline text={o} /></li>)}
          </ul>
        </div>
      ) : null}
      {doc.prerequisites.length ? (
        <p className={cn("text-[0.92em]", muted)}>
          <span className="font-medium">Before you start: </span>
          {doc.prerequisites.join("; ")}
        </p>
      ) : null}
    </div>
  );
}

export function ReferencesList({ doc }: { doc: StructuredContent }) {
  if (!doc.references.length) return null;
  return (
    <section aria-labelledby="refs" className={cn("mt-14 border-t pt-8", border)}>
      <h2 id="refs" className="text-[1.1em] font-semibold">References</h2>
      <ol className={cn("mt-3 flex list-decimal flex-col gap-2 pl-5 text-[0.9em]", muted)}>
        {doc.references.map((r) => (
          <li key={r.id}>
            {r.citation}
            {r.url ? (
              <> <a href={r.url} className="text-accent underline" target="_blank" rel="noopener noreferrer nofollow">Link</a></>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
