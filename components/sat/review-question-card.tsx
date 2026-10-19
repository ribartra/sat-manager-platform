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
        "scroll-mt-20 rounded-lg border border-gray-200 border-l-4 bg-white p-4",
        state === "ok" && "border-l-green-500",
        state === "bad" && "border-l-red-500",
        state === "blank" && "border-l-gray-300",
        state === "answered" && "border-l-blue-300",
      )}
    >
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">Question {number}</span>
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
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
          {tags}
          {timeSpent ? <span>{formatTime(timeSpent)}</span> : null}
        </div>
      </div>

      {question.stimulus?.trim() ? (
        <MathContent content={question.stimulus} className="mb-3 rounded-md bg-gray-50 p-3 text-sm text-gray-700" />
      ) : null}
      <MathContent content={question.stem} className="mb-3 text-sm text-gray-800" />
      <QuestionMedia imageUrl={question.imageUrl} alt={`Question ${number} image`} className="mb-3" />

      {responseType === "MC" ? (
        <div className="mb-3 space-y-1">
          {question.options.filter(isAnswerOption).map((opt) => {
            const picked = answer === opt.label;
            const right = reveal && question.correctAnswer === opt.label;
            return (
              <div
                key={opt.label}
                className={cn(
                  "flex items-start gap-2 rounded px-2 py-1 text-sm",
                  right ? "bg-green-50 text-green-800" : picked ? (reveal ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-800") : "text-gray-600",
                )}
              >
                <span className="w-4 font-medium">{opt.label})</span>
                <span className="min-w-0 flex-1"><OptionContent text={opt.text} imageUrl={opt.imageUrl} label={opt.label} /></span>
                {right && picked ? <span className="shrink-0 text-xs font-medium">✓ Your answer · Correct</span> : null}
                {right && !picked ? <span className="shrink-0 text-xs font-medium">✓ Correct answer</span> : null}
                {!right && picked ? <span className="shrink-0 text-xs font-medium">{reveal ? "✗ Your answer" : "Your answer"}</span> : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mb-3 flex flex-wrap gap-3 text-sm">
          <span className="rounded border border-gray-200 px-2 py-1 text-gray-600">
            Your answer: <span className="font-medium text-gray-900">{answer || <em className="text-gray-400">blank</em>}</span>
          </span>
          {reveal ? (
            <span className="rounded border border-green-200 bg-green-50 px-2 py-1 text-green-800">
              Correct answer: <span className="font-medium">{formatCorrectAnswer(question.correctAnswer)}</span>
            </span>
          ) : null}
        </div>
      )}

      {blank ? <p className="mb-2 text-xs italic text-gray-500">{blankNote}</p> : null}
      {children}

      {reveal && question.explanation ? (
        <details className="mt-2 border-t border-gray-100 pt-2" open={!isCorrect}>
          <summary className="cursor-pointer select-none text-xs font-medium text-gray-600">Explanation</summary>
          <MathContent content={question.explanation} className="mt-1 text-sm text-gray-700" />
        </details>
      ) : null}
    </article>
  );
}
