import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { renderEbookPdf } from "@/lib/pdf/document";
import { verifyPdfBytes } from "@/lib/pdf/verify";
import { maskEmail, watermarkPdf } from "@/lib/pdf/watermark";
import { fixtureItems, fixtureVersions } from "@/lib/data/fixtures";

const item = fixtureItems.find((i) => i.slug === "resting-membrane-potential")!;
const version = fixtureVersions.find((v) => v.content_item_id === item.id)!;

describe("ebook PDF generation", () => {
  it("renders a valid, multi-page PDF with scientific symbols", async () => {
    const buf = await renderEbookPdf(
      {
        title: item.title,
        subtitle: item.subtitle,
        subject: item.subject!.name,
        byline: item.byline,
        reviewerName: null,
        versionNumber: 1,
        updatedAt: item.updated_at,
        siteUrl: "https://studysimplify.test",
      },
      version.structured_content,
    );
    const bytes = new Uint8Array(buf);
    const check = await verifyPdfBytes(bytes);
    expect(check.ok).toBe(true);
    if (check.ok) {
      // cover + contents + one page per section at least
      expect(check.pageCount).toBeGreaterThanOrEqual(2 + version.structured_content.sections.length);
    }
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toBe(item.title);
    if (process.env.PDF_OUT) (await import("node:fs")).writeFileSync(process.env.PDF_OUT, bytes);
  }, 60_000);
});

describe("PDF verification", () => {
  it("rejects non-PDF and empty files", async () => {
    expect(await verifyPdfBytes(new Uint8Array())).toEqual({ ok: false, reason: "The file is empty." });
    expect((await verifyPdfBytes(new TextEncoder().encode("<html>not a pdf</html>".repeat(10)))).ok).toBe(false);
  });

  it("rejects a damaged PDF", async () => {
    const res = await verifyPdfBytes(new TextEncoder().encode("%PDF-1.7\n garbage garbage garbage"));
    expect(res.ok).toBe(false);
  });

  it("rejects a PDF with no pages", async () => {
    const empty = await (await PDFDocument.create()).save({ addDefaultPage: false });
    expect(await verifyPdfBytes(empty)).toEqual({ ok: false, reason: "The PDF has no pages." });
  });
});

describe("buyer watermark", () => {
  it("masks the email address", () => {
    expect(maskEmail("jane.doe@example.com")).toBe("j***e@example.com");
    expect(maskEmail("ab@x.io")).toBe("a@x.io");
    expect(maskEmail(null)).toBe("a registered reader");
  });

  it("stamps every page and keeps the PDF valid", async () => {
    const src = await PDFDocument.create();
    src.addPage();
    src.addPage();
    const original = await src.save();
    const out = await watermarkPdf(original, { email: "student@example.com", reference: "ORDER123" });
    const check = await verifyPdfBytes(out);
    expect(check).toMatchObject({ ok: true, pageCount: 2 });
    // Each page gained a content stream and the embedded font.
    const stamped = await PDFDocument.load(out);
    for (const page of stamped.getPages()) expect(page.node.Contents()).toBeDefined();
    expect(out.byteLength).toBeGreaterThan(original.byteLength);
  });
});
