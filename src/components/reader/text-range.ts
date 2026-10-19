/**
 * Locate `text` inside `root`'s rendered text and return a DOM Range for it.
 * Whitespace is matched flexibly (selection strings and textContent differ in
 * line breaks). When the same text occurs more than once, the occurrence
 * preceded by `prefix` wins. Returns null if the text no longer exists, e.g.
 * after the note was revised.
 */
export function findTextRange(root: Node, text: string, prefix = ""): Range | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: { node: Text; start: number }[] = [];
  let full = "";
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n as Text;
    // Skip KaTeX's hidden MathML duplicate to keep offsets aligned with what users see.
    if (t.parentElement?.closest(".katex-mathml")) continue;
    nodes.push({ node: t, start: full.length });
    full += t.data;
  }
  const match = locate(full, text, prefix);
  if (!match) return null;
  const startPos = resolve(nodes, match.start);
  const endPos = resolve(nodes, match.end);
  if (!startPos || !endPos) return null;
  const range = document.createRange();
  range.setStart(startPos.node, startPos.offset);
  range.setEnd(endPos.node, endPos.offset);
  return range;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function locate(haystack: string, text: string, prefix = ""): { start: number; end: number } | null {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  const pattern = new RegExp(words.map(escapeRegExp).join("\\s*"), "g");
  const candidates: { start: number; end: number }[] = [];
  for (let m = pattern.exec(haystack); m; m = pattern.exec(haystack)) {
    candidates.push({ start: m.index, end: m.index + m[0].length });
    if (m[0].length === 0) pattern.lastIndex++;
  }
  if (!candidates.length) return null;
  const p = prefix.replace(/\s+/g, " ").trim();
  if (p) {
    const tail = p.slice(-16);
    const withPrefix = candidates.find((c) => haystack.slice(Math.max(0, c.start - 64), c.start).replace(/\s+/g, " ").trim().endsWith(tail));
    if (withPrefix) return withPrefix;
  }
  return candidates[0];
}

function resolve(nodes: { node: Text; start: number }[], pos: number) {
  for (let i = nodes.length - 1; i >= 0; i--) {
    if (pos >= nodes[i].start) {
      return { node: nodes[i].node, offset: Math.min(pos - nodes[i].start, nodes[i].node.data.length) };
    }
  }
  return null;
}
