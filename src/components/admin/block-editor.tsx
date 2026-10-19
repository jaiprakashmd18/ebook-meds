"use client";

import { useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Copy, Eye, ImagePlus, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import {
  BLOCK_TYPES,
  CALLOUT_VARIANTS,
  DEPTH_LABELS,
  DEPTH_LEVELS,
  SECTION_KIND_LABELS,
  SECTION_KINDS,
  structuredContentSchema,
  type Block,
  type BlockType,
  type Section,
  type StructuredContent,
} from "@/lib/content/schema";
import { saveContentVersion, uploadContentImage } from "@/server/actions/admin/content";
import { slugify, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Checkbox, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { DocumentIntro, ReferencesList, SectionView } from "@/components/content/blocks";
import { renderLatex } from "@/components/content/inline";

const BLOCK_LABELS: Record<BlockType, string> = {
  heading: "Heading",
  paragraph: "Paragraph",
  list: "List",
  table: "Table",
  image: "Image",
  callout: "Callout box",
  equation: "Equation",
  diagram: "Diagram",
  mcq: "MCQ",
  definition: "Definition",
  expandable: "Expandable explanation",
  explainer: "Technical + simplified",
  question: "Oral / short-answer question",
};

function newBlock(type: BlockType): Block {
  switch (type) {
    case "heading": return { type, level: 3, text: "" };
    case "paragraph": return { type, text: "" };
    case "list": return { type, ordered: false, items: [""] };
    case "table": return { type, headers: ["Column 1", "Column 2"], rows: [["", ""]] };
    case "image": return { type, src: "", alt: "" };
    case "callout": return { type, variant: "note", text: "" };
    case "equation": return { type, latex: "", fallbackText: "" };
    case "diagram": return { type, title: "", layout: "flow", steps: [{ label: "" }, { label: "" }] };
    case "mcq": return { type, question: "", options: ["", "", "", ""], answerIndex: 0, explanation: "" };
    case "definition": return { type, term: "", definition: "" };
    case "expandable": return { type, summary: "", text: "" };
    case "explainer": return { type, technical: "", simplified: "" };
    case "question": return { type, kind: "oral", question: "", answer: "" };
  }
}

const lines = (s: string) => s.split("\n");
const move = <T,>(arr: T[], i: number, d: number) => {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const copy = arr.slice();
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
};

export function BlockEditor({ itemId, initial }: { itemId: string; initial: StructuredContent }) {
  const [doc, setDoc] = useState<StructuredContent>(initial);
  const [open, setOpen] = useState<string | null>(initial.sections[0]?.id ?? null);
  const [mode, setMode] = useState<"edit" | "preview" | "json">("edit");
  const [summary, setSummary] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [jsonText, setJsonText] = useState("");
  const [pending, start] = useTransition();
  const [dirty, setDirty] = useState(false);

  const update = (fn: (d: StructuredContent) => StructuredContent) => {
    setDoc((d) => fn(d));
    setDirty(true);
  };
  const updateSection = (i: number, patch: Partial<Section>) =>
    update((d) => ({ ...d, sections: d.sections.map((s, k) => (k === i ? { ...s, ...patch } : s)) }));
  const updateBlock = (si: number, bi: number, block: Block) =>
    update((d) => ({
      ...d,
      sections: d.sections.map((s, k) => (k === si ? { ...s, blocks: s.blocks.map((b, j) => (j === bi ? block : b)) } : s)),
    }));

  const validation = structuredContentSchema.safeParse(doc);

  const save = () => {
    if (!validation.success) {
      const issue = validation.error.issues[0];
      setResult({ ok: false, message: `Fix before saving — ${issue.path.join(" › ")}: ${issue.message}` });
      return;
    }
    start(async () => {
      const res = await saveContentVersion({ id: itemId, content: validation.data, summary });
      if (res.ok) {
        setResult({ ok: true, message: res.message ?? "Saved." });
        setSummary("");
        setDirty(false);
      } else setResult({ ok: false, message: res.error });
    });
  };

  const addSection = () => {
    const base = `section-${doc.sections.length + 1}`;
    const id = doc.sections.some((s) => s.id === base) ? `${base}-${Date.now() % 1000}` : base;
    update((d) => ({ ...d, sections: [...d.sections, { id, title: "New section", kind: "custom", preview: false, blocks: [newBlock("paragraph")] }] }));
    setOpen(id);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Editor mode">
        {(["edit", "preview", "json"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              if (m === "json") setJsonText(JSON.stringify(doc, null, 2));
              setMode(m);
            }}
            className={cn("rounded-full px-3.5 py-1.5 text-sm", mode === m ? "bg-foreground text-background" : "bg-surface hover:bg-border")}
          >
            {m === "edit" ? <><Pencil className="mr-1 inline size-3.5" />Edit</> : m === "preview" ? <><Eye className="mr-1 inline size-3.5" />Student preview</> : "JSON"}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground" aria-live="polite">
          {validation.success ? (dirty ? "Unsaved changes" : "No unsaved changes") : <span className="text-danger">Has validation errors</span>}
        </span>
      </div>

      {mode === "preview" ? (
        <div data-reader-theme="light" className="rounded-[var(--radius-lg)] border border-border bg-[var(--reader-bg)] p-6 text-[var(--reader-fg)] sm:p-10">
          {validation.success ? (
            <div className="prose-study mx-auto flex max-w-[680px] flex-col gap-12">
              <DocumentIntro doc={validation.data} />
              {validation.data.sections.map((s) => (
                <div key={s.id}>
                  {s.preview ? <p className="mb-2 text-xs font-medium text-success">Included in free preview</p> : null}
                  <SectionView section={s} />
                </div>
              ))}
              <ReferencesList doc={validation.data} />
            </div>
          ) : (
            <Alert tone="danger">Fix validation errors to preview: {validation.error.issues[0]?.message}</Alert>
          )}
        </div>
      ) : mode === "json" ? (
        <div className="flex flex-col gap-3">
          <Label htmlFor="json">Structured content (JSON)</Label>
          <Textarea id="json" value={jsonText} onChange={(e) => setJsonText(e.target.value)} className="min-h-[480px] font-mono text-xs" spellCheck={false} />
          <div>
            <Button
              variant="outline"
              onClick={() => {
                try {
                  const parsed = structuredContentSchema.safeParse(JSON.parse(jsonText));
                  if (!parsed.success) {
                    setResult({ ok: false, message: `JSON is not valid content: ${parsed.error.issues[0]?.path.join(" › ")} ${parsed.error.issues[0]?.message}` });
                    return;
                  }
                  setDoc(parsed.data);
                  setDirty(true);
                  setMode("edit");
                  setResult({ ok: true, message: "JSON applied. Review and save as a new version." });
                } catch {
                  setResult({ ok: false, message: "That is not valid JSON." });
                }
              }}
            >
              Apply JSON
            </Button>
          </div>
        </div>
      ) : (
        <>
          <details className="rounded-[var(--radius-md)] border border-border bg-background p-4" open>
            <summary className="cursor-pointer text-sm font-medium">Document front matter</summary>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="d-subtitle">Subtitle</Label>
                <Input id="d-subtitle" value={doc.subtitle ?? ""} onChange={(e) => update((d) => ({ ...d, subtitle: e.target.value || undefined }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="d-overview">Overview</Label>
                <Textarea id="d-overview" rows={2} value={doc.overview ?? ""} onChange={(e) => update((d) => ({ ...d, overview: e.target.value || undefined }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="d-lo">Learning objectives (one per line)</Label>
                <Textarea id="d-lo" rows={4} value={doc.learningObjectives.join("\n")} onChange={(e) => update((d) => ({ ...d, learningObjectives: lines(e.target.value) }))} onBlur={() => update((d) => ({ ...d, learningObjectives: d.learningObjectives.filter((l) => l.trim()) }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="d-pre">Prerequisites (one per line)</Label>
                <Textarea id="d-pre" rows={4} value={doc.prerequisites.join("\n")} onChange={(e) => update((d) => ({ ...d, prerequisites: lines(e.target.value) }))} onBlur={() => update((d) => ({ ...d, prerequisites: d.prerequisites.filter((l) => l.trim()) }))} />
              </div>
            </div>
            <ReferencesEditor doc={doc} update={update} />
          </details>

          <ol className="flex flex-col gap-3">
            {doc.sections.map((s, si) => {
              const isOpen = open === s.id;
              return (
                <li key={si} className="rounded-[var(--radius-md)] border border-border bg-background">
                  <div className="flex items-center gap-2 p-3">
                    <button onClick={() => setOpen(isOpen ? null : s.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={isOpen}>
                      {isOpen ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
                      <span className="truncate font-medium">{si + 1}. {s.title || "Untitled section"}</span>
                      {s.preview ? <span className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] text-success">Preview</span> : null}
                      <span className="text-xs text-muted-foreground">{s.blocks.length} blocks</span>
                    </button>
                    <Button variant="ghost" size="icon-sm" aria-label="Move section up" onClick={() => update((d) => ({ ...d, sections: move(d.sections, si, -1) }))} disabled={si === 0}><ArrowUp /></Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Move section down" onClick={() => update((d) => ({ ...d, sections: move(d.sections, si, 1) }))} disabled={si === doc.sections.length - 1}><ArrowDown /></Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Delete section" onClick={() => { if (confirm(`Delete section "${s.title}"?`)) update((d) => ({ ...d, sections: d.sections.filter((_, k) => k !== si) })); }}><Trash2 /></Button>
                  </div>
                  {isOpen ? (
                    <div className="border-t border-border p-4">
                      <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr]">
                        <div className="flex flex-col gap-1">
                          <Label htmlFor={`s-title-${si}`}>Section title</Label>
                          <Input id={`s-title-${si}`} value={s.title} onChange={(e) => updateSection(si, { title: e.target.value })} />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label htmlFor={`s-id-${si}`}>Anchor id</Label>
                          <div className="flex gap-1">
                            <Input id={`s-id-${si}`} value={s.id} onChange={(e) => { updateSection(si, { id: e.target.value }); setOpen(e.target.value); }} className="font-mono text-xs" />
                            <Button variant="ghost" size="icon" type="button" title="Generate from title" aria-label="Generate id from title" onClick={() => { const id = slugify(s.title).slice(0, 60) || `section-${si + 1}`; updateSection(si, { id }); setOpen(id); }}><Copy /></Button>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label htmlFor={`s-kind-${si}`}>Section type</Label>
                          <Select id={`s-kind-${si}`} value={s.kind} onChange={(e) => updateSection(si, { kind: e.target.value as Section["kind"] })}>
                            {SECTION_KINDS.map((k) => <option key={k} value={k}>{SECTION_KIND_LABELS[k]}</option>)}
                          </Select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label htmlFor={`s-depth-${si}`}>Depth label</Label>
                          <Select id={`s-depth-${si}`} value={s.depth ?? ""} onChange={(e) => updateSection(si, { depth: (e.target.value || undefined) as Section["depth"] })}>
                            <option value="">None</option>
                            {DEPTH_LEVELS.map((d) => <option key={d} value={d}>{DEPTH_LABELS[d]}</option>)}
                          </Select>
                        </div>
                      </div>
                      <label className="mt-3 flex items-center gap-2 text-sm">
                        <Checkbox checked={s.preview} onChange={(e) => updateSection(si, { preview: e.target.checked })} /> Include in the free preview
                      </label>

                      <ol className="mt-5 flex flex-col gap-3">
                        {s.blocks.map((b, bi) => (
                          <li key={bi} className="rounded-[var(--radius-sm)] border border-border bg-surface/50 p-3">
                            <div className="mb-2 flex items-center gap-1">
                              <span className="flex-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{BLOCK_LABELS[b.type]}</span>
                              <Button variant="ghost" size="icon-sm" aria-label="Move block up" disabled={bi === 0} onClick={() => updateSection(si, { blocks: move(s.blocks, bi, -1) })}><ArrowUp /></Button>
                              <Button variant="ghost" size="icon-sm" aria-label="Move block down" disabled={bi === s.blocks.length - 1} onClick={() => updateSection(si, { blocks: move(s.blocks, bi, 1) })}><ArrowDown /></Button>
                              <Button variant="ghost" size="icon-sm" aria-label="Delete block" onClick={() => updateSection(si, { blocks: s.blocks.filter((_, k) => k !== bi) })}><Trash2 /></Button>
                            </div>
                            <BlockFields block={b} onChange={(nb) => updateBlock(si, bi, nb)} idPrefix={`b-${si}-${bi}`} />
                          </li>
                        ))}
                      </ol>
                      <AddBlock onAdd={(t) => updateSection(si, { blocks: [...s.blocks, newBlock(t)] })} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
          <div>
            <Button variant="outline" onClick={addSection}><Plus /> Add section</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Inline formatting: **bold**, *italic*, `code`, $latex$, H~2~O, Ca^2+^, [link](https://…). HTML is shown as text, never executed.
            If no section is marked for preview, the first section is used as the preview.
          </p>
        </>
      )}

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:flex-row sm:items-center">
        <label htmlFor="summary" className="sr-only">Change summary</label>
        <Input id="summary" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="What changed? (shown in version history)" className="h-10 flex-1 text-sm" maxLength={1000} />
        <Button onClick={save} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null} Save as new version
        </Button>
      </div>
      {result ? <Alert tone={result.ok ? "success" : "danger"}>{result.message}</Alert> : null}
    </div>
  );
}

function AddBlock({ onAdd }: { onAdd: (t: BlockType) => void }) {
  const [type, setType] = useState<BlockType>("paragraph");
  return (
    <div className="mt-3 flex items-center gap-2">
      <label htmlFor="add-block" className="sr-only">Block type</label>
      <Select value={type} onChange={(e) => setType(e.target.value as BlockType)} className="h-9 w-56 text-sm">
        {BLOCK_TYPES.map((t) => <option key={t} value={t}>{BLOCK_LABELS[t]}</option>)}
      </Select>
      <Button variant="secondary" size="sm" onClick={() => onAdd(type)}><Plus /> Add block</Button>
    </div>
  );
}

function ReferencesEditor({ doc, update }: { doc: StructuredContent; update: (fn: (d: StructuredContent) => StructuredContent) => void }) {
  return (
    <div className="mt-5">
      <p className="text-sm font-medium">References</p>
      <p className="text-xs text-muted-foreground">Cite real sources only. Never invent citations.</p>
      <ol className="mt-2 flex flex-col gap-2">
        {doc.references.map((r, i) => (
          <li key={i} className="flex flex-col gap-2 sm:flex-row">
            <Input aria-label={`Citation ${i + 1}`} value={r.citation} placeholder="Author(s). Title. Publisher." onChange={(e) => update((d) => ({ ...d, references: d.references.map((x, k) => (k === i ? { ...x, citation: e.target.value } : x)) }))} className="h-9 flex-[3] text-sm" />
            <Input aria-label={`Link ${i + 1}`} value={r.url ?? ""} placeholder="https://… (optional)" onChange={(e) => update((d) => ({ ...d, references: d.references.map((x, k) => (k === i ? { ...x, url: e.target.value || undefined } : x)) }))} className="h-9 flex-[2] text-sm" />
            <Button variant="ghost" size="icon-sm" aria-label="Remove reference" onClick={() => update((d) => ({ ...d, references: d.references.filter((_, k) => k !== i) }))}><Trash2 /></Button>
          </li>
        ))}
      </ol>
      <Button variant="ghost" size="sm" className="mt-2" onClick={() => update((d) => ({ ...d, references: [...d.references, { id: `ref-${Date.now().toString(36)}`, citation: "" }] }))}>
        <Plus /> Add reference
      </Button>
    </div>
  );
}

function F({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function BlockFields({ block, onChange, idPrefix }: { block: Block; onChange: (b: Block) => void; idPrefix: string }) {
  const t = "text-sm";
  switch (block.type) {
    case "heading":
      return (
        <div className="grid gap-2 sm:grid-cols-[120px_1fr]">
          <F label="Level" id={`${idPrefix}-l`}>
            <Select id={`${idPrefix}-l`} value={block.level} onChange={(e) => onChange({ ...block, level: Number(e.target.value) as 3 | 4 })} className="h-9 text-sm">
              <option value={3}>Heading</option><option value={4}>Subheading</option>
            </Select>
          </F>
          <F label="Text" id={`${idPrefix}-t`}><Input id={`${idPrefix}-t`} value={block.text} onChange={(e) => onChange({ ...block, text: e.target.value })} className="h-9 text-sm" /></F>
        </div>
      );
    case "paragraph":
      return <F label="Text" id={`${idPrefix}-t`}><Textarea id={`${idPrefix}-t`} rows={4} value={block.text} onChange={(e) => onChange({ ...block, text: e.target.value })} className={t} /></F>;
    case "list":
      return (
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={block.ordered} onChange={(e) => onChange({ ...block, ordered: e.target.checked })} /> Numbered list</label>
          <F label="Items (one per line)" id={`${idPrefix}-i`}>
            <Textarea id={`${idPrefix}-i`} rows={5} value={block.items.join("\n")} onChange={(e) => onChange({ ...block, items: lines(e.target.value) })} className={t} />
          </F>
        </div>
      );
    case "table":
      return (
        <div className="flex flex-col gap-2">
          <F label="Caption" id={`${idPrefix}-c`}><Input id={`${idPrefix}-c`} value={block.caption ?? ""} onChange={(e) => onChange({ ...block, caption: e.target.value || undefined })} className="h-9 text-sm" /></F>
          <F label="Table — first line is the header; separate cells with |" id={`${idPrefix}-tb`}>
            <Textarea
              id={`${idPrefix}-tb`}
              rows={6}
              className="font-mono text-xs"
              value={[block.headers.join(" | "), ...block.rows.map((r) => r.join(" | "))].join("\n")}
              onChange={(e) => {
                const rows = lines(e.target.value).map((l) => l.split("|").map((c) => c.trim()));
                const headers = rows[0] ?? [""];
                onChange({ ...block, headers, rows: rows.slice(1).map((r) => headers.map((_, i) => r[i] ?? "")) });
              }}
            />
          </F>
        </div>
      );
    case "image":
      return <ImageFields block={block} onChange={onChange} idPrefix={idPrefix} />;
    case "callout":
      return (
        <div className="grid gap-2 sm:grid-cols-[160px_1fr]">
          <F label="Style" id={`${idPrefix}-v`}>
            <Select id={`${idPrefix}-v`} value={block.variant} onChange={(e) => onChange({ ...block, variant: e.target.value as typeof block.variant })} className="h-9 text-sm">
              {CALLOUT_VARIANTS.map((v) => <option key={v} value={v}>{v}</option>)}
            </Select>
          </F>
          <F label="Title (optional)" id={`${idPrefix}-ti`}><Input id={`${idPrefix}-ti`} value={block.title ?? ""} onChange={(e) => onChange({ ...block, title: e.target.value || undefined })} className="h-9 text-sm" /></F>
          <div className="sm:col-span-2"><F label="Text" id={`${idPrefix}-t`}><Textarea id={`${idPrefix}-t`} rows={3} value={block.text} onChange={(e) => onChange({ ...block, text: e.target.value })} className={t} /></F></div>
        </div>
      );
    case "equation":
      return (
        <div className="flex flex-col gap-2">
          <F label="LaTeX" id={`${idPrefix}-x`}><Textarea id={`${idPrefix}-x`} rows={2} value={block.latex} onChange={(e) => onChange({ ...block, latex: e.target.value })} className="font-mono text-xs" spellCheck={false} /></F>
          {block.latex ? <div className="overflow-x-auto rounded bg-background p-2 text-center" dangerouslySetInnerHTML={{ __html: renderLatex(block.latex, true) }} /> : null}
          <F label="Plain-text version (used in PDFs and by screen readers)" id={`${idPrefix}-f`}><Input id={`${idPrefix}-f`} value={block.fallbackText} onChange={(e) => onChange({ ...block, fallbackText: e.target.value })} className="h-9 text-sm" /></F>
          <F label="Caption" id={`${idPrefix}-c`}><Input id={`${idPrefix}-c`} value={block.caption ?? ""} onChange={(e) => onChange({ ...block, caption: e.target.value || undefined })} className="h-9 text-sm" /></F>
        </div>
      );
    case "diagram":
      return (
        <div className="flex flex-col gap-2">
          <div className="grid gap-2 sm:grid-cols-[1fr_160px]">
            <F label="Title" id={`${idPrefix}-t`}><Input id={`${idPrefix}-t`} value={block.title} onChange={(e) => onChange({ ...block, title: e.target.value })} className="h-9 text-sm" /></F>
            <F label="Layout" id={`${idPrefix}-l`}>
              <Select id={`${idPrefix}-l`} value={block.layout} onChange={(e) => onChange({ ...block, layout: e.target.value as typeof block.layout })} className="h-9 text-sm">
                <option value="flow">Flow</option><option value="cycle">Cycle</option><option value="labelled">Labelled list</option>
              </Select>
            </F>
          </div>
          <F label="Steps — one per line, as: Label :: optional detail" id={`${idPrefix}-s`}>
            <Textarea
              id={`${idPrefix}-s`}
              rows={5}
              className={t}
              value={block.steps.map((s) => (s.detail ? `${s.label} :: ${s.detail}` : s.label)).join("\n")}
              onChange={(e) => onChange({ ...block, steps: lines(e.target.value).map((l) => { const [label, ...rest] = l.split("::"); const detail = rest.join("::").trim(); return { label: label.trim(), ...(detail ? { detail } : {}) }; }) })}
            />
          </F>
          <F label="Caption" id={`${idPrefix}-c`}><Input id={`${idPrefix}-c`} value={block.caption ?? ""} onChange={(e) => onChange({ ...block, caption: e.target.value || undefined })} className="h-9 text-sm" /></F>
        </div>
      );
    case "mcq":
      return (
        <div className="flex flex-col gap-2">
          <F label="Question" id={`${idPrefix}-q`}><Textarea id={`${idPrefix}-q`} rows={2} value={block.question} onChange={(e) => onChange({ ...block, question: e.target.value })} className={t} /></F>
          <F label="Options (one per line, 2–6)" id={`${idPrefix}-o`}><Textarea id={`${idPrefix}-o`} rows={4} value={block.options.join("\n")} onChange={(e) => onChange({ ...block, options: lines(e.target.value) })} className={t} /></F>
          <F label="Correct answer" id={`${idPrefix}-a`}>
            <Select id={`${idPrefix}-a`} value={block.answerIndex} onChange={(e) => onChange({ ...block, answerIndex: Number(e.target.value) })} className="h-9 text-sm">
              {block.options.map((o, i) => <option key={i} value={i}>{String.fromCharCode(65 + i)}. {o.slice(0, 60)}</option>)}
            </Select>
          </F>
          <F label="Explanation" id={`${idPrefix}-e`}><Textarea id={`${idPrefix}-e`} rows={3} value={block.explanation} onChange={(e) => onChange({ ...block, explanation: e.target.value })} className={t} /></F>
        </div>
      );
    case "definition":
      return (
        <div className="flex flex-col gap-2">
          <F label="Term" id={`${idPrefix}-t`}><Input id={`${idPrefix}-t`} value={block.term} onChange={(e) => onChange({ ...block, term: e.target.value })} className="h-9 text-sm" /></F>
          <F label="Precise definition" id={`${idPrefix}-d`}><Textarea id={`${idPrefix}-d`} rows={3} value={block.definition} onChange={(e) => onChange({ ...block, definition: e.target.value })} className={t} /></F>
          <F label="In simple words (optional — must not change the meaning)" id={`${idPrefix}-s`}><Textarea id={`${idPrefix}-s`} rows={2} value={block.simplified ?? ""} onChange={(e) => onChange({ ...block, simplified: e.target.value || undefined })} className={t} /></F>
        </div>
      );
    case "expandable":
      return (
        <div className="flex flex-col gap-2">
          <F label="Summary (always visible)" id={`${idPrefix}-s`}><Input id={`${idPrefix}-s`} value={block.summary} onChange={(e) => onChange({ ...block, summary: e.target.value })} className="h-9 text-sm" /></F>
          <F label="Hidden explanation" id={`${idPrefix}-t`}><Textarea id={`${idPrefix}-t`} rows={4} value={block.text} onChange={(e) => onChange({ ...block, text: e.target.value })} className={t} /></F>
        </div>
      );
    case "explainer":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <F label="Precise / technical" id={`${idPrefix}-t`}><Textarea id={`${idPrefix}-t`} rows={4} value={block.technical} onChange={(e) => onChange({ ...block, technical: e.target.value })} className={t} /></F>
          <F label="Simplified (same meaning)" id={`${idPrefix}-s`}><Textarea id={`${idPrefix}-s`} rows={4} value={block.simplified} onChange={(e) => onChange({ ...block, simplified: e.target.value })} className={t} /></F>
        </div>
      );
    case "question":
      return (
        <div className="flex flex-col gap-2">
          <F label="Kind" id={`${idPrefix}-k`}>
            <Select id={`${idPrefix}-k`} value={block.kind} onChange={(e) => onChange({ ...block, kind: e.target.value as typeof block.kind })} className="h-9 w-56 text-sm">
              <option value="oral">Oral / viva</option><option value="short-answer">Short answer</option>
            </Select>
          </F>
          <F label="Question" id={`${idPrefix}-q`}><Textarea id={`${idPrefix}-q`} rows={2} value={block.question} onChange={(e) => onChange({ ...block, question: e.target.value })} className={t} /></F>
          <F label="Model answer" id={`${idPrefix}-a`}><Textarea id={`${idPrefix}-a`} rows={3} value={block.answer} onChange={(e) => onChange({ ...block, answer: e.target.value })} className={t} /></F>
        </div>
      );
  }
}

function ImageFields({ block, onChange, idPrefix }: { block: Extract<Block, { type: "image" }>; onChange: (b: Block) => void; idPrefix: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const fd = new FormData();
            fd.set("image", f);
            setError(null);
            start(async () => {
              const res = await uploadContentImage(fd);
              if (res.ok && res.data) onChange({ ...block, src: res.data.src });
              else if (!res.ok) setError(res.error);
            });
          }}
        />
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <ImagePlus />} Upload image
        </Button>
        <span className="truncate font-mono text-xs text-muted-foreground">{block.src || "No image yet"}</span>
      </div>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <F label="Alt text (describe the image for screen readers)" id={`${idPrefix}-a`}><Input id={`${idPrefix}-a`} value={block.alt} onChange={(e) => onChange({ ...block, alt: e.target.value })} className="h-9 text-sm" /></F>
      <F label="Caption" id={`${idPrefix}-c`}><Input id={`${idPrefix}-c`} value={block.caption ?? ""} onChange={(e) => onChange({ ...block, caption: e.target.value || undefined })} className="h-9 text-sm" /></F>
    </div>
  );
}
