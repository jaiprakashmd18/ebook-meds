import "server-only";
import path from "node:path";
import { Document, Font, Image, Link, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import type { Block, Section, StructuredContent } from "@/lib/content/schema";
import { SECTION_KIND_LABELS } from "@/lib/content/schema";
import { parseInline, type InlineToken } from "@/lib/content/inline";
import { resolveImageSrc } from "@/lib/content/images";

/*
 * Branded ebook PDF. DejaVu Sans is embedded because it covers Greek
 * letters, arrows, sub/superscript digits and mathematical symbols that the
 * built-in PDF fonts cannot display.
 */

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
let fontsRegistered = false;
function registerFonts() {
  if (fontsRegistered) return;
  Font.register({
    family: "DejaVu",
    fonts: [
      { src: path.join(FONT_DIR, "DejaVuSans.ttf") },
      { src: path.join(FONT_DIR, "DejaVuSans-Bold.ttf"), fontWeight: "bold" },
      { src: path.join(FONT_DIR, "DejaVuSans-Oblique.ttf"), fontStyle: "italic" },
      { src: path.join(FONT_DIR, "DejaVuSans-BoldOblique.ttf"), fontWeight: "bold", fontStyle: "italic" },
    ],
  });
  Font.register({ family: "DejaVuMono", src: path.join(FONT_DIR, "DejaVuSansMono.ttf") });
  // Avoid automatic hyphenation of scientific terms.
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

const C = { text: "#1d1d1f", muted: "#6e6e73", border: "#e5e5ea", panel: "#f5f5f7", accent: "#3478f6" };

const s = StyleSheet.create({
  page: { fontFamily: "DejaVu", fontSize: 10.5, lineHeight: 1.55, color: C.text, paddingTop: 64, paddingBottom: 64, paddingHorizontal: 60 },
  header: { position: "absolute", top: 28, left: 60, right: 60, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: C.muted, borderBottomWidth: 0.5, borderBottomColor: C.border, paddingBottom: 6 },
  footer: { position: "absolute", bottom: 28, left: 60, right: 60, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: C.muted },
  coverPage: { fontFamily: "DejaVu", padding: 64, color: C.text, justifyContent: "space-between" },
  h1: { fontSize: 28, fontWeight: "bold", lineHeight: 1.2 },
  h2: { fontSize: 17, fontWeight: "bold", marginBottom: 8, lineHeight: 1.3 },
  h3: { fontSize: 13, fontWeight: "bold", marginTop: 12, marginBottom: 4 },
  h4: { fontSize: 11, fontWeight: "bold", marginTop: 8, marginBottom: 3 },
  p: { marginBottom: 7 },
  muted: { color: C.muted },
  eyebrow: { fontSize: 8, color: C.accent, fontWeight: "bold", letterSpacing: 1, marginBottom: 4, textTransform: "uppercase" },
  box: { borderWidth: 0.75, borderColor: C.border, borderRadius: 6, padding: 10, marginBottom: 10 },
  callout: { borderLeftWidth: 2.5, borderLeftColor: C.accent, backgroundColor: C.panel, padding: 10, marginBottom: 10 },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.border },
  th: { flex: 1, padding: 5, fontWeight: "bold", fontSize: 9, backgroundColor: C.panel },
  td: { flex: 1, padding: 5, fontSize: 9 },
  mono: { fontFamily: "DejaVuMono", fontSize: 10 },
  tocRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: C.border },
});

function Inline({ tokens, base }: { tokens: InlineToken[]; base?: Style }) {
  return (
    <>
      {tokens.map((t, i) => {
        switch (t.kind) {
          case "text":
            return <Text key={i} style={base}>{t.value}</Text>;
          case "bold":
            return <Text key={i} style={{ fontWeight: "bold" }}><Inline tokens={t.children} /></Text>;
          case "italic":
            return <Text key={i} style={{ fontStyle: "italic" }}><Inline tokens={t.children} /></Text>;
          case "code":
          case "math":
            return <Text key={i} style={s.mono}>{t.value}</Text>;
          case "sub":
            return <Text key={i} style={{ fontSize: 7, verticalAlign: "sub" }}>{t.value}</Text>;
          case "sup":
            return <Text key={i} style={{ fontSize: 7, verticalAlign: "super" }}>{t.value}</Text>;
          case "link":
            return <Link key={i} src={t.href} style={{ color: C.accent }}><Inline tokens={t.children} /></Link>;
        }
      })}
    </>
  );
}

const T = ({ text, style }: { text: string; style?: Style }) => (
  <Text style={style}>
    <Inline tokens={parseInline(text)} />
  </Text>
);

type McqRef = { n: number; block: Extract<Block, { type: "mcq" }> };

function BlockPdf({ block, mcqs }: { block: Block; mcqs: McqRef[] }) {
  switch (block.type) {
    case "heading":
      return <View minPresenceAhead={60}><T text={block.text} style={block.level === 3 ? s.h3 : s.h4} /></View>;
    case "paragraph":
      return <T text={block.text} style={s.p} />;
    case "list":
      return (
        <View style={{ marginBottom: 8 }}>
          {block.items.map((item, i) => (
            <View key={i} style={{ flexDirection: "row", marginBottom: 3 }} wrap={false}>
              <Text style={{ width: 16 }}>{block.ordered ? `${i + 1}.` : "•"}</Text>
              <View style={{ flex: 1 }}><T text={item} /></View>
            </View>
          ))}
        </View>
      );
    case "table":
      return (
        <View style={{ marginBottom: 10, borderWidth: 0.5, borderColor: C.border }}>
          <View style={s.tableRow} fixed>
            {block.headers.map((h, i) => <View key={i} style={s.th}><T text={h} /></View>)}
          </View>
          {block.rows.map((r, ri) => (
            <View key={ri} style={s.tableRow} wrap={false}>
              {r.map((c, ci) => <View key={ci} style={s.td}><T text={c} /></View>)}
            </View>
          ))}
          {block.caption ? <T text={block.caption} style={{ ...s.muted, fontSize: 8.5, padding: 5 }} /> : null}
        </View>
      );
    case "image":
      return (
        <View style={{ marginBottom: 10, alignItems: "center" }} wrap={false}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt; the caption carries the description */}
          <Image src={resolveImageSrc(block.src)} style={{ maxHeight: 300, maxWidth: "100%", objectFit: "contain" }} />
          <T text={block.caption ?? block.alt} style={{ ...s.muted, fontSize: 8.5, marginTop: 4, textAlign: "center" }} />
        </View>
      );
    case "callout":
      return (
        <View style={s.callout} wrap={false}>
          <Text style={s.eyebrow}>{block.variant === "mistake" ? "Common mistake" : block.variant === "exam" ? "Exam focus" : block.variant}</Text>
          {block.title ? <T text={block.title} style={{ fontWeight: "bold", marginBottom: 3 }} /> : null}
          <T text={block.text} />
        </View>
      );
    case "equation":
      return (
        <View style={{ marginVertical: 8, alignItems: "center" }} wrap={false}>
          <Text style={{ ...s.mono, fontSize: 11 }}>{block.fallbackText}</Text>
          {block.caption ? <T text={block.caption} style={{ ...s.muted, fontSize: 8.5, marginTop: 4, textAlign: "center" }} /> : null}
        </View>
      );
    case "diagram":
      return (
        <View style={s.box} wrap={false}>
          <Text style={s.eyebrow}>{block.title}</Text>
          {block.steps.map((st, i) => (
            <View key={i} style={{ flexDirection: "row", marginBottom: 4 }}>
              <Text style={{ width: 22, color: C.accent, fontWeight: "bold" }}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <T text={st.label} style={{ fontWeight: "bold" }} />
                {st.detail ? <T text={st.detail} style={s.muted} /> : null}
              </View>
              {block.layout !== "labelled" && i < block.steps.length - 1 ? <Text style={{ color: C.muted }}>↓</Text> : null}
            </View>
          ))}
          {block.caption ? <T text={block.caption} style={{ ...s.muted, fontSize: 8.5 }} /> : null}
        </View>
      );
    case "mcq": {
      const n = mcqs.length + 1;
      mcqs.push({ n, block });
      return (
        <View style={s.box} wrap={false}>
          <T text={`Q${n}. ${block.question}`} style={{ fontWeight: "bold", marginBottom: 4 }} />
          {block.options.map((o, i) => <T key={i} text={`${String.fromCharCode(65 + i)}.  ${o}`} style={{ marginBottom: 2 }} />)}
          <Text style={{ ...s.muted, fontSize: 8, marginTop: 4 }}>Answer and explanation: see Answer key.</Text>
        </View>
      );
    }
    case "definition":
      return (
        <View style={s.box} wrap={false}>
          <T text={block.term} style={{ fontWeight: "bold", marginBottom: 3 }} />
          <T text={block.definition} />
          {block.simplified ? <T text={`In simple words: ${block.simplified}`} style={{ ...s.muted, marginTop: 4 }} /> : null}
        </View>
      );
    case "expandable":
      return (
        <View style={{ marginBottom: 8 }} wrap={false}>
          <T text={block.summary} style={{ fontWeight: "bold" }} />
          <T text={block.text} />
        </View>
      );
    case "explainer":
      return (
        <View style={{ ...s.box, flexDirection: "row", gap: 10 }} wrap={false}>
          <View style={{ flex: 1 }}>
            <Text style={s.eyebrow}>Precise definition</Text>
            <T text={block.technical} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.eyebrow}>Simplified</Text>
            <T text={block.simplified} />
          </View>
        </View>
      );
    case "question":
      return (
        <View style={s.box} wrap={false}>
          <Text style={s.eyebrow}>{block.kind === "oral" ? "Viva question" : "Short-answer question"}</Text>
          <T text={block.question} style={{ fontWeight: "bold", marginBottom: 3 }} />
          <T text={block.answer} />
        </View>
      );
  }
}

export type PdfMeta = {
  title: string;
  subtitle: string | null;
  subject: string;
  byline: string | null;
  reviewerName: string | null;
  versionNumber: number;
  updatedAt: string;
  siteUrl: string;
};

function SectionPdf({ section, mcqs, onPage, first }: { section: Section; mcqs: McqRef[]; onPage: (id: string, page: number) => void; first: boolean }) {
  return (
    <View break={!first} style={{ marginBottom: 6 }}>
      <View minPresenceAhead={120}>
        <Text
          style={{ fontSize: 0.1, color: "#ffffff" }}
          render={({ pageNumber }) => {
            onPage(section.id, pageNumber);
            return " ";
          }}
        />
        <Text style={s.eyebrow}>{SECTION_KIND_LABELS[section.kind] ?? ""}</Text>
        <Text style={s.h2} id={section.id}>{section.title}</Text>
      </View>
      {section.blocks.map((b, i) => <BlockPdf key={i} block={b} mcqs={mcqs} />)}
    </View>
  );
}

function EbookDocument({ meta, doc, pages, onPage }: { meta: PdfMeta; doc: StructuredContent; pages: Map<string, number>; onPage: (id: string, page: number) => void }) {
  const mcqs: McqRef[] = [];
  const date = new Date(meta.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const Chrome = () => (
    <>
      <View style={s.header} fixed>
        <Text>{meta.title}</Text>
        <Text>StudySimplify</Text>
      </View>
      <View style={s.footer} fixed>
        <Text>Version {meta.versionNumber} · {date}</Text>
        <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </View>
    </>
  );
  return (
    <Document title={meta.title} author={meta.byline ?? "StudySimplify"} subject={meta.subject} creator="StudySimplify" producer="StudySimplify">
      <Page size="A4" style={s.coverPage}>
        <View>
          <Text style={{ fontSize: 10, letterSpacing: 2, color: C.accent, fontWeight: "bold" }}>{meta.subject.toUpperCase()}</Text>
        </View>
        <View>
          <Text style={s.h1}>{meta.title}</Text>
          {meta.subtitle ? <Text style={{ fontSize: 14, color: C.muted, marginTop: 10 }}>{meta.subtitle}</Text> : null}
        </View>
        <View style={{ borderTopWidth: 0.75, borderTopColor: C.border, paddingTop: 14, fontSize: 9, color: C.muted }}>
          {meta.byline ? <Text>Author: {meta.byline}</Text> : null}
          <Text>{meta.reviewerName ? `Reviewed by: ${meta.reviewerName}` : "Not yet independently reviewed"}</Text>
          <Text>Version {meta.versionNumber} · Updated {date}</Text>
          <Text style={{ marginTop: 10, fontSize: 12, color: C.text, fontWeight: "bold" }}>StudySimplify</Text>
          <Text>Learn difficult topics the easy way.</Text>
        </View>
      </Page>

      <Page size="A4" style={s.page}>
        <Chrome />
        <Text style={s.h2}>Contents</Text>
        {doc.sections.map((sec, i) => (
          <View key={sec.id} style={s.tocRow}>
            <Link src={`#${sec.id}`} style={{ color: C.text, textDecoration: "none" }}>{`${i + 1}. ${sec.title}`}</Link>
            <Text style={s.muted}>{pages.get(sec.id) ?? ""}</Text>
          </View>
        ))}
        {doc.learningObjectives.length ? (
          <View style={{ marginTop: 18 }}>
            <Text style={s.h3}>Learning objectives</Text>
            {doc.learningObjectives.map((o, i) => <T key={i} text={`•  ${o}`} style={{ marginBottom: 2 }} />)}
          </View>
        ) : null}
        {doc.prerequisites.length ? <T text={`Before you start: ${doc.prerequisites.join("; ")}`} style={{ ...s.muted, marginTop: 10 }} /> : null}
      </Page>

      <Page size="A4" style={s.page} wrap>
        <Chrome />
        {doc.sections.map((sec, i) => <SectionPdf key={sec.id} section={sec} mcqs={mcqs} onPage={onPage} first={i === 0} />)}

        {mcqs.length ? (
          <View break>
            <Text style={s.h2}>Answer key</Text>
            {mcqs.map(({ n, block }) => (
              <View key={n} style={{ marginBottom: 8 }} wrap={false}>
                <T text={`Q${n}: ${String.fromCharCode(65 + block.answerIndex)}. ${block.options[block.answerIndex]}`} style={{ fontWeight: "bold" }} />
                <T text={block.explanation} />
              </View>
            ))}
          </View>
        ) : null}

        {doc.references.length ? (
          <View break={!mcqs.length} style={{ marginTop: 16 }}>
            <Text style={s.h2}>References</Text>
            {doc.references.map((r, i) => <Text key={r.id} style={{ marginBottom: 3, fontSize: 9.5 }}>{`${i + 1}. ${r.citation}${r.url ? ` ${r.url}` : ""}`}</Text>)}
          </View>
        ) : null}

        <View style={{ marginTop: 24, ...s.box }} wrap={false}>
          <Text style={{ fontWeight: "bold", marginBottom: 4 }}>Copyright and usage</Text>
          <Text style={{ fontSize: 9 }}>
            © {new Date(meta.updatedAt).getFullYear()} StudySimplify. Licensed for the purchaser&apos;s personal study only. Do not
            share, resell or redistribute. This material is educational and is not medical advice. Report errors at {meta.siteUrl}.
          </Text>
        </View>
      </Page>
    </Document>
  );
}

/**
 * Render the ebook. Runs twice: the first pass records the page on which each
 * section starts, the second fills the table of contents with those numbers.
 */
export async function renderEbookPdf(meta: PdfMeta, doc: StructuredContent): Promise<Buffer> {
  registerFonts();
  const pages = new Map<string, number>();
  // react-pdf calls dynamic render props again after pagination, so the last
  // value recorded for a section is its final page.
  const record = (id: string, page: number) => {
    pages.set(id, page);
  };
  await renderToBuffer(<EbookDocument meta={meta} doc={doc} pages={new Map()} onPage={record} />);
  const final = new Map(pages);
  return renderToBuffer(<EbookDocument meta={meta} doc={doc} pages={final} onPage={() => {}} />);
}
