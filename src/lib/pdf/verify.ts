import { PDFDocument } from "pdf-lib";
import { isPdf, MAX_PDF_BYTES } from "@/lib/files";

export type PdfCheck =
  | { ok: true; pageCount: number; sizeBytes: number }
  | { ok: false; reason: string };

/**
 * Quality gate run before a PDF can be attached to a product: correct file
 * signature, size limits, parses as a PDF, not encrypted, and has pages.
 */
export async function verifyPdfBytes(bytes: Uint8Array): Promise<PdfCheck> {
  if (bytes.byteLength === 0) return { ok: false, reason: "The file is empty." };
  if (bytes.byteLength > MAX_PDF_BYTES) return { ok: false, reason: "The file is larger than 100 MB." };
  if (!isPdf(bytes)) return { ok: false, reason: "The file is not a PDF." };
  try {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const pageCount = doc.getPageCount();
    if (pageCount < 1) return { ok: false, reason: "The PDF has no pages." };
    const first = doc.getPage(0).getSize();
    if (!first.width || !first.height) return { ok: false, reason: "The first page has no size." };
    return { ok: true, pageCount, sizeBytes: bytes.byteLength };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/encrypt/i.test(msg)) return { ok: false, reason: "Encrypted PDFs are not supported. Upload an unprotected file." };
    return { ok: false, reason: "The PDF could not be read. It may be damaged." };
  }
}
