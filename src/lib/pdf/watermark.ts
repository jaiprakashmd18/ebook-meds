import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/** Mask an email for a licence line: "jane.doe@example.com" → "j•••e@example.com". */
export function maskEmail(email: string | null): string {
  if (!email || !email.includes("@")) return "a registered reader";
  const [local, domain] = email.split("@");
  const visible = local.length <= 2 ? local[0] : `${local[0]}***${local[local.length - 1]}`;
  return `${visible}@${domain}`;
}

/**
 * Add a small, unobtrusive licence line to the bottom of every page. This
 * discourages casual sharing; it is not copy protection.
 */
export async function watermarkPdf(bytes: Uint8Array, licence: { email: string | null; reference: string }): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  // Standard fonts only support WinAnsi; strip anything else from the line.
  const line = `Licensed to ${maskEmail(licence.email)} · Ref ${licence.reference} · Personal study only`.replace(/[^\x20-\x7E·]/g, "");
  for (const page of doc.getPages()) {
    const { width } = page.getSize();
    const size = 6.5;
    const textWidth = font.widthOfTextAtSize(line, size);
    page.drawText(line, { x: (width - textWidth) / 2, y: 12, size, font, color: rgb(0.55, 0.55, 0.58), opacity: 0.85 });
  }
  return doc.save();
}
