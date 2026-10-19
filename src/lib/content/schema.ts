import { z } from "zod";

/**
 * Structured content format (schemaVersion 1).
 *
 * Notes are stored as validated JSON rather than HTML. The renderer maps
 * each block type to React elements and never injects author-supplied HTML.
 * Inline text supports a small, safe markdown subset (see inline.tsx).
 */

export const SECTION_KINDS = [
  "overview",
  "why-it-matters",
  "learning-objectives",
  "prerequisites",
  "first-principles",
  "definitions",
  "step-by-step",
  "examples",
  "comparisons",
  "diagrams",
  "mechanisms",
  "misconceptions",
  "clinical-relevance",
  "frequently-confused",
  "high-yield",
  "mnemonics",
  "practice-mcqs",
  "oral-questions",
  "short-answer",
  "summary",
  "glossary",
  "references",
  "custom",
] as const;

export const SECTION_KIND_LABELS: Record<(typeof SECTION_KINDS)[number], string> = {
  overview: "Short overview",
  "why-it-matters": "Why this topic matters",
  "learning-objectives": "Learning objectives",
  prerequisites: "Prerequisite concepts",
  "first-principles": "Explanation from first principles",
  definitions: "Important definitions",
  "step-by-step": "Step-by-step explanation",
  examples: "Examples and analogies",
  comparisons: "Tables and comparisons",
  diagrams: "Diagrams and illustrations",
  mechanisms: "Mechanisms and pathways",
  misconceptions: "Common misconceptions",
  "clinical-relevance": "Clinical or practical relevance",
  "frequently-confused": "Frequently confused concepts",
  "high-yield": "High-yield revision points",
  mnemonics: "Mnemonics",
  "practice-mcqs": "Practice MCQs",
  "oral-questions": "Oral examination questions",
  "short-answer": "Short-answer questions",
  summary: "Quick revision summary",
  glossary: "Glossary",
  references: "References",
  custom: "Custom section",
};

export const DEPTH_LEVELS = ["basic", "detailed", "advanced", "exam", "clinical", "mistake"] as const;

export const DEPTH_LABELS: Record<(typeof DEPTH_LEVELS)[number], string> = {
  basic: "Basic concept",
  detailed: "Detailed explanation",
  advanced: "Advanced detail",
  exam: "Exam focus",
  clinical: "Clinical relevance",
  mistake: "Common mistake",
};

const text = (max = 8000) => z.string().trim().min(1, "Required").max(max);
const optionalText = (max = 8000) => z.string().trim().max(max).optional();

const id = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{0,63}$/, "Use lowercase letters, numbers and dashes");

/** Images may only reference our own storage or same-origin paths. */
const imageSrc = z
  .string()
  .trim()
  .max(1000)
  .refine(
    (v) => v.startsWith("/") || v.startsWith("storage:") || /^https:\/\/[a-z0-9.-]+\.supabase\.co\//i.test(v),
    "Images must be uploaded to StudySimplify storage",
  );

export const headingBlock = z.object({ type: z.literal("heading"), level: z.union([z.literal(3), z.literal(4)]), text: text(300) });
export const paragraphBlock = z.object({ type: z.literal("paragraph"), text: text() });
export const listBlock = z.object({
  type: z.literal("list"),
  ordered: z.boolean().default(false),
  items: z.array(text(2000)).min(1).max(100),
});
export const tableBlock = z
  .object({
    type: z.literal("table"),
    caption: optionalText(300),
    headers: z.array(text(200)).min(1).max(8),
    rows: z.array(z.array(z.string().trim().max(1000))).min(1).max(100),
  })
  .refine((t) => t.rows.every((r) => r.length === t.headers.length), {
    message: "Every row must have one cell per column",
    path: ["rows"],
  });
export const imageBlock = z.object({
  type: z.literal("image"),
  src: imageSrc,
  alt: text(300),
  caption: optionalText(500),
});
export const CALLOUT_VARIANTS = ["note", "tip", "warning", "exam", "clinical", "mistake", "mnemonic"] as const;
export const calloutBlock = z.object({
  type: z.literal("callout"),
  variant: z.enum(CALLOUT_VARIANTS),
  title: optionalText(200),
  text: text(),
});
export const equationBlock = z.object({
  type: z.literal("equation"),
  latex: text(2000),
  /** Plain-text/Unicode rendering used in PDFs and for screen readers. */
  fallbackText: text(1000),
  caption: optionalText(300),
});
export const diagramBlock = z.object({
  type: z.literal("diagram"),
  title: text(200),
  layout: z.enum(["flow", "cycle", "labelled"]).default("flow"),
  steps: z
    .array(z.object({ label: text(200), detail: optionalText(500) }))
    .min(2)
    .max(20),
  caption: optionalText(500),
});
export const mcqBlock = z
  .object({
    type: z.literal("mcq"),
    question: text(2000),
    options: z.array(text(500)).min(2).max(6),
    answerIndex: z.number().int().min(0),
    explanation: text(),
  })
  .refine((q) => q.answerIndex < q.options.length, { message: "Answer must be one of the options", path: ["answerIndex"] });
export const definitionBlock = z.object({
  type: z.literal("definition"),
  term: text(200),
  definition: text(),
  simplified: optionalText(2000),
});
export const expandableBlock = z.object({ type: z.literal("expandable"), summary: text(300), text: text() });
export const explainerBlock = z.object({
  type: z.literal("explainer"),
  /** Precise scientific statement. */
  technical: text(),
  /** Plain-language restatement. Must not change the meaning. */
  simplified: text(),
});
export const questionBlock = z.object({
  type: z.literal("question"),
  kind: z.enum(["oral", "short-answer"]),
  question: text(2000),
  answer: text(),
});

export const blockSchema = z.union([
  headingBlock,
  paragraphBlock,
  listBlock,
  tableBlock,
  imageBlock,
  calloutBlock,
  equationBlock,
  diagramBlock,
  mcqBlock,
  definitionBlock,
  expandableBlock,
  explainerBlock,
  questionBlock,
]);

export const BLOCK_TYPES = [
  "heading",
  "paragraph",
  "list",
  "table",
  "image",
  "callout",
  "equation",
  "diagram",
  "mcq",
  "definition",
  "expandable",
  "explainer",
  "question",
] as const;

export const sectionSchema = z.object({
  id,
  title: text(200),
  kind: z.enum(SECTION_KINDS).default("custom"),
  depth: z.enum(DEPTH_LEVELS).optional(),
  /** Included in the free preview of a paid item. */
  preview: z.boolean().default(false),
  blocks: z.array(blockSchema).max(400),
});

export const referenceSchema = z.object({
  id,
  citation: text(1000),
  url: z
    .string()
    .trim()
    .url()
    .refine((u) => u.startsWith("https://"), "Use an https link")
    .optional(),
});

export const structuredContentSchema = z
  .object({
    schemaVersion: z.literal(1),
    subtitle: optionalText(300),
    overview: optionalText(4000),
    learningObjectives: z.array(text(500)).max(30).default([]),
    prerequisites: z.array(text(500)).max(30).default([]),
    references: z.array(referenceSchema).max(100).default([]),
    sections: z.array(sectionSchema).min(1, "Add at least one section").max(80),
  })
  .superRefine((doc, ctx) => {
    const seen = new Set<string>();
    doc.sections.forEach((s, i) => {
      if (seen.has(s.id)) {
        ctx.addIssue({ code: "custom", message: `Duplicate section id "${s.id}"`, path: ["sections", i, "id"] });
      }
      seen.add(s.id);
    });
  });

export type Block = z.infer<typeof blockSchema>;
export type BlockType = Block["type"];
export type Section = z.infer<typeof sectionSchema>;
export type Reference = z.infer<typeof referenceSchema>;
export type StructuredContent = z.infer<typeof structuredContentSchema>;

export function parseStructuredContent(input: unknown): StructuredContent {
  return structuredContentSchema.parse(input);
}

export function emptyStructuredContent(): StructuredContent {
  return {
    schemaVersion: 1,
    learningObjectives: [],
    prerequisites: [],
    references: [],
    sections: [{ id: "overview", title: "Overview", kind: "overview", preview: true, blocks: [] }],
  };
}

/** Plain text of a block, used for search-in-document, word counts and PDFs. */
export function blockPlainText(block: Block): string {
  switch (block.type) {
    case "heading":
    case "paragraph":
      return block.text;
    case "list":
      return block.items.join("\n");
    case "table":
      return [block.caption ?? "", block.headers.join(" | "), ...block.rows.map((r) => r.join(" | "))].join("\n");
    case "image":
      return [block.alt, block.caption ?? ""].join(" ");
    case "callout":
      return [block.title ?? "", block.text].join("\n");
    case "equation":
      return [block.fallbackText, block.caption ?? ""].join(" ");
    case "diagram":
      return [block.title, ...block.steps.map((s) => `${s.label} ${s.detail ?? ""}`), block.caption ?? ""].join("\n");
    case "mcq":
      return [block.question, ...block.options, block.explanation].join("\n");
    case "definition":
      return [block.term, block.definition, block.simplified ?? ""].join("\n");
    case "expandable":
      return [block.summary, block.text].join("\n");
    case "explainer":
      return [block.technical, block.simplified].join("\n");
    case "question":
      return [block.question, block.answer].join("\n");
  }
}

export function sectionPlainText(section: Section): string {
  return [section.title, ...section.blocks.map(blockPlainText)].join("\n");
}

const WORDS_PER_MINUTE = 200;

export function estimateReadingMinutes(doc: StructuredContent): number {
  const words = doc.sections
    .map(sectionPlainText)
    .join(" ")
    .replace(/[*_`$\\]/g, "")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

/** Return only the sections a visitor without access may read. */
export function previewOf(doc: StructuredContent): StructuredContent {
  const sections = doc.sections.filter((s) => s.preview);
  return { ...doc, sections: sections.length ? sections : doc.sections.slice(0, 1) };
}
