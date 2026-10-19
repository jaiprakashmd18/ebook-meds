"use client";

import { useActionState, useState } from "react";
import { Flag, Star } from "lucide-react";
import { submitContentReport, submitReview } from "@/server/actions/feedback";
import { initialActionState } from "@/server/actions/types";
import { SubmitButton } from "@/components/ui/submit-button";
import { Field, Select, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function ReviewForm({ contentItemId, slug, initialRating, initialText }: { contentItemId: string; slug: string; initialRating?: number; initialText?: string | null }) {
  const [state, action] = useActionState(submitReview, initialActionState);
  const [rating, setRating] = useState(initialRating ?? 0);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="contentItemId" value={contentItemId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="rating" value={rating || ""} />
      <fieldset>
        <legend className="text-sm font-medium">Your rating</legend>
        <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Rating out of 5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              onClick={() => setRating(n)}
              className="rounded p-1"
            >
              <Star className={cn("size-6", n <= rating ? "fill-warning text-warning" : "text-border-strong")} />
            </button>
          ))}
        </div>
      </fieldset>
      <Field label="Review (optional)" htmlFor="reviewText">
        <Textarea id="reviewText" name="reviewText" maxLength={3000} defaultValue={initialText ?? ""} placeholder="What helped you? What could be clearer?" />
      </Field>
      {!state.ok ? <Alert tone="danger">{state.error}</Alert> : state.message ? <Alert tone="success">{state.message}</Alert> : null}
      <div><SubmitButton pendingLabel="Saving…">Submit review</SubmitButton></div>
    </form>
  );
}

export function ReportDialog({
  contentItemId,
  sectionId,
  reviewId,
  trigger,
  defaultKind = "inaccuracy",
}: {
  contentItemId: string;
  sectionId?: string;
  reviewId?: string;
  trigger?: React.ReactNode;
  defaultKind?: "inaccuracy" | "unclear" | "typo" | "feedback" | "review_abuse" | "other";
}) {
  const [state, action] = useActionState(submitContentReport, initialActionState);
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm"><Flag /> Report an error</Button>
        )}
      </DialogTrigger>
      <DialogContent title={reviewId ? "Report this review" : "Report a problem or give feedback"} description="Reports go privately to our editors. Fixes are published as a new version of the notes.">
        {state.ok && state.message ? (
          <Alert tone="success">{state.message}</Alert>
        ) : (
          <form action={action} className="flex flex-col gap-4">
            <input type="hidden" name="contentItemId" value={contentItemId} />
            <input type="hidden" name="sectionId" value={sectionId ?? ""} />
            <input type="hidden" name="reviewId" value={reviewId ?? ""} />
            {reviewId ? (
              <input type="hidden" name="kind" value="review_abuse" />
            ) : (
              <Field label="Type" htmlFor="kind">
                <Select id="kind" name="kind" defaultValue={defaultKind}>
                  <option value="inaccuracy">Scientific inaccuracy</option>
                  <option value="unclear">Unclear explanation</option>
                  <option value="typo">Typo or formatting</option>
                  <option value="feedback">General feedback</option>
                  <option value="other">Other</option>
                </Select>
              </Field>
            )}
            <Field label="Details" htmlFor="message">
              <Textarea id="message" name="message" required minLength={5} maxLength={4000} placeholder="What is wrong or unclear? If possible, cite a reference." />
            </Field>
            {!reviewId ? (
              <Field label="How difficult did this feel? (optional)" htmlFor="difficultyRating">
                <Select id="difficultyRating" name="difficultyRating" defaultValue="">
                  <option value="">Prefer not to say</option>
                  <option value="1">1 — very easy</option>
                  <option value="2">2</option>
                  <option value="3">3 — about right</option>
                  <option value="4">4</option>
                  <option value="5">5 — very hard</option>
                </Select>
              </Field>
            ) : null}
            {!state.ok ? <Alert tone="danger">{state.error}</Alert> : null}
            <div className="flex justify-end"><SubmitButton pendingLabel="Sending…">Send report</SubmitButton></div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
