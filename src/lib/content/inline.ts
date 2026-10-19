/**
 * Safe inline formatting.
 *
 * Supported syntax (anything else is literal text):
 *   **bold**   *italic*   `code`   $inline latex$
 *   H~2~O (subscript)   Ca^2+^ (superscript)   [label](https://link)
 *
 * The parser produces a token tree. Renderers (web and PDF) turn tokens into
 * elements; raw HTML in the source is never interpreted, so `<script>` is
 * displayed as text.
 */

export type InlineToken =
  | { kind: "text"; value: string }
  | { kind: "bold"; children: InlineToken[] }
  | { kind: "italic"; children: InlineToken[] }
  | { kind: "code"; value: string }
  | { kind: "math"; value: string }
  | { kind: "sub"; value: string }
  | { kind: "sup"; value: string }
  | { kind: "link"; href: string; children: InlineToken[] };

const MAX_DEPTH = 4;

function isSafeHref(href: string): boolean {
  if (href.startsWith("/") && !href.startsWith("//")) return true;
  try {
    const url = new URL(href);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export function parseInline(source: string, depth = 0): InlineToken[] {
  const out: InlineToken[] = [];
  let buffer = "";
  let i = 0;

  const flush = () => {
    if (buffer) {
      out.push({ kind: "text", value: buffer });
      buffer = "";
    }
  };

  const tryDelimited = (open: string, close: string): string | null => {
    if (!source.startsWith(open, i)) return null;
    const end = source.indexOf(close, i + open.length);
    if (end === -1 || end === i + open.length) return null;
    const inner = source.slice(i + open.length, end);
    if (inner.includes("\n")) return null;
    i = end + close.length;
    return inner;
  };

  while (i < source.length) {
    const ch = source[i];

    if (ch === "\\" && i + 1 < source.length && "*`$~^[]\\".includes(source[i + 1])) {
      buffer += source[i + 1];
      i += 2;
      continue;
    }

    if (ch === "`") {
      const start = i;
      const inner = tryDelimited("`", "`");
      if (inner !== null) {
        flush();
        out.push({ kind: "code", value: inner });
        continue;
      }
      i = start;
    }

    if (ch === "$") {
      const start = i;
      const inner = tryDelimited("$", "$");
      if (inner !== null && !/^\s|\s$/.test(inner)) {
        flush();
        out.push({ kind: "math", value: inner });
        continue;
      }
      i = start;
    }

    if (ch === "*" && depth < MAX_DEPTH) {
      const start = i;
      const bold = tryDelimited("**", "**");
      if (bold !== null) {
        flush();
        out.push({ kind: "bold", children: parseInline(bold, depth + 1) });
        continue;
      }
      i = start;
      if (source[i + 1] !== "*") {
        const italic = tryDelimited("*", "*");
        if (italic !== null && !/^\s/.test(italic)) {
          flush();
          out.push({ kind: "italic", children: parseInline(italic, depth + 1) });
          continue;
        }
        i = start;
      }
    }

    if (ch === "~" || ch === "^") {
      const start = i;
      const inner = tryDelimited(ch, ch);
      if (inner !== null && inner.length <= 20 && !/\s/.test(inner)) {
        flush();
        out.push({ kind: ch === "~" ? "sub" : "sup", value: inner });
        continue;
      }
      i = start;
    }

    if (ch === "[" && depth < MAX_DEPTH) {
      const close = source.indexOf("](", i);
      const end = close === -1 ? -1 : source.indexOf(")", close + 2);
      if (close !== -1 && end !== -1) {
        const label = source.slice(i + 1, close);
        const href = source.slice(close + 2, end).trim();
        if (label && !label.includes("\n") && isSafeHref(href)) {
          flush();
          out.push({ kind: "link", href, children: parseInline(label, depth + 1) });
          i = end + 1;
          continue;
        }
      }
    }

    buffer += ch;
    i++;
  }
  flush();
  return out;
}

export function inlineToPlainText(tokens: InlineToken[]): string {
  return tokens
    .map((t) => {
      switch (t.kind) {
        case "text":
        case "code":
        case "math":
        case "sub":
        case "sup":
          return t.value;
        default:
          return inlineToPlainText(t.children);
      }
    })
    .join("");
}

export function stripInline(source: string): string {
  return inlineToPlainText(parseInline(source));
}
