import katex from "katex";
import { Fragment } from "react";
import { parseInline, type InlineToken } from "@/lib/content/inline";

/**
 * Render LaTeX with KaTeX. `trust: false` blocks \href, \url, \includegraphics
 * and HTML extensions, and KaTeX escapes all text, so its output is safe to
 * insert. This is the ONLY place author input becomes HTML.
 */
export function renderLatex(latex: string, displayMode: boolean): string {
  return katex.renderToString(latex, {
    displayMode,
    throwOnError: false,
    trust: false,
    strict: "ignore",
    maxSize: 20,
    maxExpand: 200,
    output: "htmlAndMathml",
  });
}

function Token({ t }: { t: InlineToken }) {
  switch (t.kind) {
    case "text":
      return <>{t.value}</>;
    case "bold":
      return <strong className="font-semibold">{t.children.map((c, i) => <Token key={i} t={c} />)}</strong>;
    case "italic":
      return <em>{t.children.map((c, i) => <Token key={i} t={c} />)}</em>;
    case "code":
      return <code className="rounded bg-[var(--reader-panel,var(--surface))] px-1 py-0.5 font-mono text-[0.9em]">{t.value}</code>;
    case "sub":
      return <sub>{t.value}</sub>;
    case "sup":
      return <sup>{t.value}</sup>;
    case "math":
      return <span dangerouslySetInnerHTML={{ __html: renderLatex(t.value, false) }} />;
    case "link": {
      const external = !t.href.startsWith("/");
      return (
        <a
          href={t.href}
          className="text-accent underline underline-offset-2"
          {...(external ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})}
        >
          {t.children.map((c, i) => <Token key={i} t={c} />)}
        </a>
      );
    }
  }
}

export function Inline({ text }: { text: string }) {
  const tokens = parseInline(text);
  return (
    <>
      {tokens.map((t, i) => (
        <Fragment key={i}>
          <Token t={t} />
        </Fragment>
      ))}
    </>
  );
}
