import { CheckCircle, MinusCircle, XCircle } from "lucide-react";
import { MathContent } from "@/components/math-content";
import { OptionContent } from "@/components/option-content";
import { QuestionMedia } from "@/components/question-media";
import { Badge } from "@/components/ui/badge";
import { formatCorrectAnswer } from "@/lib/answer-grading";
import { isAnswerOption, resolveQuestionType } from "@/lib/question-type";
import { cn, formatTime } from "@/lib/utils";

export type ReviewQuestion = {
  stem: string;
  stimulus: string | null;
  type: string;
  correctAnswer: string;
  explanation: string | null;
  imageUrl: string | null;
  options: { label: string; text: string; imageUrl?: string | null }[];
};

/**
 * One answered question in a results page: the student's answer, the correct one and the
 * explanation (open by default when the answer was wrong or blank). `id` is the scroll target of
 * the answer grid. With `reveal={false}` (the teacher hid the solutions) only the student's own
 * answer is shown: no right/wrong marks, correct answer or explanation.
 */
export function ReviewQuestionCard({
  id,
  number,
  question,
  answer,
  isCorrect,
  timeSpent,
  tags,
  reveal = true,
  blankNote = "You left this question blank. Blank answers count as incorrect.",
  children,
}: {
  id: string;
  number: number;
  question: ReviewQuestion;
  answer: string | null;
  isCorrect: boolean;
  timeSpent?: number | null;
  tags?: React.ReactNode;
  reveal?: boolean;
  blankNote?: string;
  children?: React.ReactNode;
}) {
  const blank = !answer;
  const responseType = resolveQuestionType(question.type, question.options);
  const state = blank ? "blank" : !reveal ? "answered" : isCorrect ? "ok" : "bad";
  return (
    <article
      id={id}
      className={cn(
        // Mockup `.qcard`: radius 10, 4px left rule in the result colour; question text in Georgia.
        "scroll-mt-20 rounded-[var(--sat-radius)] border border-[var(--sat-border)] border-l-4 bg-white px-[18px] py-4",
        state === "ok" && "border-l-[var(--sat-ok)]",
        state === "bad" && "border-l-[var(--sat-bad)]",
        state === "blank" && "border-l-[var(--sat-blank)]",
        state === "answered" && "border-l-blue-300",
      )}
    >
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[var(--sat-text)]">Question {number}</span>
          {state === "ok" ? (
            <Badge variant="success"><CheckCircle size={12} className="mr-1" /> Correct</Badge>
          ) : state === "bad" ? (
            <Badge variant="danger"><XCircle size={12} className="mr-1" /> Incorrect</Badge>
          ) : state === "answered" ? (
            <Badge variant="info">Answered</Badge>
          ) : (
            <Badge><MinusCircle size={12} className="mr-1" /> Blank</Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--sat-muted)]">
          {tags}
          {timeSpent ? <span>{formatTime(timeSpent)}</span> : null}
        </div>
      </div>

      {question.stimulus?.trim() ? (
        <MathContent content={question.stimulus} className="my-2.5 whitespace-pre-wrap rounded-lg bg-[var(--sat-surface-2)] px-3.5 py-3 font-serif-q text-[15px] leading-[1.65] text-[var(--sat-text)]" />
      ) : null}
      <MathContent content={question.stem} className="mb-2.5 mt-2 font-serif-q text-[15px] text-[var(--sat-text)]" />
      <QuestionMedia imageUrl={question.imageUrl} alt={`Question ${number} image`} className="mb-3" />

      {responseType === "MC" ? (
        <div className="mb-3">
          {question.options.filter(isAnswerOption).map((opt) => {
            const picked = answer === opt.label;
            const right = reveal && question.correctAnswer === opt.label;
            return (
              <div
                key={opt.label}
                className={cn(
                  // Mockup `.opt`: Georgia row, tinted border when it is the right / picked answer.
                  "mb-1 flex items-start gap-2.5 rounded-lg border px-2.5 py-2 font-serif-q text-[15px]",
                  right
                    ? "border-[var(--sat-ok-border)] bg-[var(--sat-ok-soft)]"
                    : picked
                      ? reveal
                        ? "border-[var(--sat-bad-border)] bg-[var(--sat-bad-soft)]"
                        : "border-blue-200 bg-[var(--sat-primary-soft)]"
                      : "border-transparent",
                )}
              >
                <span className="w-[22px] shrink-0 font-sans font-bold">{opt.label}</span>
                <span className="min-w-0 flex-1"><OptionContent text={opt.text} imageUrl={opt.imageUrl} label={opt.label} /></span>
                {right && picked ? <span className="ml-auto shrink-0 font-sans text-[11px] font-bold text-[var(--sat-ok)]">✓ Your answer · Correct</span> : null}
                {right && !picked ? <span className="ml-auto shrink-0 font-sans text-[11px] font-bold text-[var(--sat-ok)]">✓ Correct answer</span> : null}
                {!right && picked ? <span className={cn("ml-auto shrink-0 font-sans text-[11px] font-bold", reveal ? "text-[var(--sat-bad)]" : "text-[var(--sat-primary)]")}>{reveal ? "✗ Your answer" : "Your answer"}</span> : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="my-1.5 flex flex-wrap gap-2.5 text-sm">
          <span className={cn("rounded-lg border px-3 py-2 font-semibold", !reveal || blank ? "border-[var(--sat-border)] text-[var(--sat-text)]" : isCorrect ? "border-[var(--sat-ok-border)] bg-[var(--sat-ok-soft)] text-[var(--sat-ok)]" : "border-[var(--sat-bad-border)] bg-[var(--sat-bad-soft)] text-[var(--sat-bad)]")}>
            Your answer: <span>{answer || <em className="font-normal text-[var(--sat-blank)]">blank</em>}</span>
          </span>
          {reveal ? (
            <span className="rounded-lg border border-[var(--sat-ok-border)] bg-[var(--sat-ok-soft)] px-3 py-2 font-semibold text-[var(--sat-ok)]">
              Correct answer: <span>{formatCorrectAnswer(question.correctAnswer)}</span>
            </span>
          ) : null}
        </div>
      )}

      {blank ? <p className="mb-2 text-xs italic text-[var(--sat-muted)]">{blankNote}</p> : null}
      {children}

      {reveal && question.explanation ? (
        <details className="mt-2.5 border-t border-[var(--sat-border)] pt-2" open={!isCorrect}>
          <summary className="cursor-pointer select-none text-[13px] font-semibold text-[var(--sat-primary)]">Explanation</summary>
          <MathContent content={question.explanation} className="mt-2 text-sm text-[var(--sat-text)]" />
        </details>
      ) : null}
    </article>
  );
}
