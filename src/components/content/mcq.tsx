"use client";

import { useId, useState } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function McqView({
  question,
  options,
  answerIndex,
  explanation,
  number,
}: {
  question: React.ReactNode;
  options: React.ReactNode[];
  answerIndex: number;
  explanation: React.ReactNode;
  number?: number;
}) {
  const [chosen, setChosen] = useState<number | null>(null);
  const id = useId();
  const answered = chosen !== null;
  return (
    <fieldset className="my-6 rounded-[var(--radius-lg)] border border-[var(--reader-border,var(--border))] p-5">
      <legend className="sr-only">Practice question{number ? ` ${number}` : ""}</legend>
      <p className="font-medium" id={`${id}-q`}>
        {number ? <span className="mr-2 text-[var(--reader-muted,var(--muted-foreground))]">Q{number}.</span> : null}
        {question}
      </p>
      <div className="mt-4 flex flex-col gap-2" role="radiogroup" aria-labelledby={`${id}-q`}>
        {options.map((opt, i) => {
          const isCorrect = i === answerIndex;
          const isChosen = chosen === i;
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={isChosen}
              disabled={answered}
              onClick={() => setChosen(i)}
              className={cn(
                "flex items-start gap-3 rounded-xl border px-4 py-3 text-left text-[0.95em] transition-colors",
                "border-[var(--reader-border,var(--border))] enabled:hover:bg-[var(--reader-panel,var(--surface))]",
                answered && isCorrect && "border-success bg-success-soft",
                answered && isChosen && !isCorrect && "border-danger bg-danger-soft",
              )}
            >
              <span className="mt-0.5 font-mono text-xs opacity-60">{String.fromCharCode(65 + i)}</span>
              <span className="flex-1">{opt}</span>
              {answered && isCorrect ? <Check className="size-4 text-success" aria-label="Correct answer" /> : null}
              {answered && isChosen && !isCorrect ? <X className="size-4 text-danger" aria-label="Your answer" /> : null}
            </button>
          );
        })}
      </div>
      <div aria-live="polite">
        {answered ? (
          <div className="mt-4 rounded-xl bg-[var(--reader-panel,var(--surface))] p-4 text-[0.95em]">
            <p className="font-medium">{chosen === answerIndex ? "Correct." : `Answer: ${String.fromCharCode(65 + answerIndex)}`}</p>
            <div className="mt-1 text-[var(--reader-muted,var(--muted-foreground))]">{explanation}</div>
            <button type="button" onClick={() => setChosen(null)} className="mt-3 text-sm text-accent hover:underline">
              Try again
            </button>
          </div>
        ) : null}
      </div>
    </fieldset>
  );
}
