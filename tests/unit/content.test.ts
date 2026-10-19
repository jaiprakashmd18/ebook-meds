import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { parseInline, stripInline } from "@/lib/content/inline";
import { estimateReadingMinutes, previewOf, structuredContentSchema } from "@/lib/content/schema";
import { fixtureVersions } from "@/lib/data/fixtures";
import { Inline } from "@/components/content/inline";
import { BlockView } from "@/components/content/blocks";

describe("inline formatting", () => {
  it("parses the supported subset", () => {
    expect(parseInline("**bold** and *it* and `x` and H~2~O and Ca^2+^")).toEqual([
      { kind: "bold", children: [{ kind: "text", value: "bold" }] },
      { kind: "text", value: " and " },
      { kind: "italic", children: [{ kind: "text", value: "it" }] },
      { kind: "text", value: " and " },
      { kind: "code", value: "x" },
      { kind: "text", value: " and H" },
      { kind: "sub", value: "2" },
      { kind: "text", value: "O and Ca" },
      { kind: "sup", value: "2+" },
    ]);
    expect(stripInline("**Na**^+^")).toBe("Na+");
  });

  it("never renders author-supplied HTML", () => {
    const html = renderToStaticMarkup(createElement(Inline, { text: '<script>alert(1)</script><img src=x onerror=alert(1)>' }));
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
  });

  it("only allows https and same-site links", () => {
    expect(parseInline("[x](javascript:alert(1))")[0]).toEqual({ kind: "text", value: "[x](javascript:alert(1))" });
    expect(parseInline("[x](//evil.test)")[0].kind).toBe("text");
    expect(parseInline("[x](https://example.org)")[0]).toMatchObject({ kind: "link", href: "https://example.org" });
    const html = renderToStaticMarkup(createElement(Inline, { text: "[ref](https://example.org)" }));
    expect(html).toContain('rel="noopener noreferrer nofollow"');
  });

  it("renders LaTeX without allowing \\href or HTML injection", () => {
    const html = renderToStaticMarkup(createElement(Inline, { text: "$\\href{javascript:alert(1)}{x}$" }));
    // \href is refused (rendered as red error text); the source survives only as escaped annotation text.
    expect(html).not.toMatch(/href=/i);
    expect(html).not.toContain("<a ");
    const injected = renderToStaticMarkup(createElement(Inline, { text: "$\\text{<img src=x onerror=alert(1)>}$" }));
    expect(injected).not.toContain("<img");
  });
});

describe("structured content schema", () => {
  it("accepts every fixture note", () => {
    for (const v of fixtureVersions) expect(structuredContentSchema.safeParse(v.structured_content).success).toBe(true);
  });

  it("rejects MCQs whose answer is not an option, tables with ragged rows and duplicate section ids", () => {
    const base = fixtureVersions[0].structured_content;
    const badMcq = { ...base, sections: [{ id: "a", title: "A", kind: "custom", preview: false, blocks: [{ type: "mcq", question: "Q", options: ["a", "b"], answerIndex: 5, explanation: "e" }] }] };
    expect(structuredContentSchema.safeParse(badMcq).success).toBe(false);
    const badTable = { ...base, sections: [{ id: "a", title: "A", kind: "custom", preview: false, blocks: [{ type: "table", headers: ["a", "b"], rows: [["only one"]] }] }] };
    expect(structuredContentSchema.safeParse(badTable).success).toBe(false);
    const dupes = { ...base, sections: [base.sections[0], base.sections[0]] };
    expect(structuredContentSchema.safeParse(dupes).success).toBe(false);
  });

  it("rejects images hosted outside our storage and script URLs in references", () => {
    const base = fixtureVersions[0].structured_content;
    const img = { ...base, sections: [{ id: "a", title: "A", kind: "custom", preview: false, blocks: [{ type: "image", src: "https://evil.test/x.png", alt: "x" }] }] };
    expect(structuredContentSchema.safeParse(img).success).toBe(false);
    const ref = { ...base, references: [{ id: "r", citation: "c", url: "javascript:alert(1)" }] };
    expect(structuredContentSchema.safeParse(ref).success).toBe(false);
  });

  it("returns only preview sections to visitors without access", () => {
    const glycolysis = fixtureVersions.find((v) => v.structured_content.subtitle?.startsWith("Ten reactions"))!.structured_content;
    const preview = previewOf(glycolysis);
    expect(preview.sections.map((s) => s.id)).toEqual(["overview", "why"]);
    expect(JSON.stringify(preview)).not.toContain("Phosphoglycerate kinase");
  });

  it("estimates reading time from word count", () => {
    expect(estimateReadingMinutes(fixtureVersions[0].structured_content)).toBeGreaterThan(0);
  });

  it("renders every block type without throwing", () => {
    for (const v of fixtureVersions) {
      for (const s of v.structured_content.sections) {
        for (const b of s.blocks) expect(() => renderToStaticMarkup(createElement(BlockView, { block: b }))).not.toThrow();
      }
    }
  });
});
