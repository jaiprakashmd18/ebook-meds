/** File-signature checks. Never trust a browser-supplied MIME type or extension. */

export function detectImageType(bytes: Uint8Array): { mime: string; ext: string } | null {
  const b = bytes;
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { mime: "image/png", ext: "png" };
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { mime: "image/webp", ext: "webp" };
  if (ascii(4, 8) === "ftyp" && ["avif", "avis"].includes(ascii(8, 12))) return { mime: "image/avif", ext: "avif" };
  return null;
}

export function isPdf(bytes: Uint8Array): boolean {
  // "%PDF-" may be preceded by a few bytes of junk in valid files; allow 1 KB.
  const head = new TextDecoder("latin1").decode(bytes.slice(0, 1024));
  return head.includes("%PDF-");
}

export const MAX_PDF_BYTES = 100 * 1024 * 1024;
