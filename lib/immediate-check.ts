import { formatCorrectAnswer, isAnswerCorrect } from "@/lib/answer-grading";
import { resolveQuestionType } from "@/lib/question-type";

/**
 * Immediate-feedback grading (RNF-11). The answer key and explanation stay on the server until
 * the student checks a question; the result is then returned (and on reload, re-sent) only for
 * the questions already checked.
 */
export interface CheckResult {
  isCorrect: boolean;
  /** Raw key (pipe-delimited when several answers are accepted), used to highlight the right choice. */
  answerKey: string;
  /** Human-readable key, e.g. "8 or 9". */
  correctAnswer: string;
  explanation: string | null;
}

interface GradableQuestion {
  type: string;
  correctAnswer: string;
  explanation: string | null;
  options: { label: string; text: string }[];
}

/**
 * Grades against the current question (a later key fix re-grades the attempt, lib/attempt-regrade.ts).
 * `showExplanation` is the attempt's "Show explanations in the player" (per assignment).
 */
export function gradeCheck(
  answer: string | null | undefined,
  question: GradableQuestion,
  { showExplanation = true }: { showExplanation?: boolean } = {},
): CheckResult {
  return {
    isCorrect: isAnswerCorrect(answer, question.correctAnswer, resolveQuestionType(question.type, question.options)),
    answerKey: question.correctAnswer,
    correctAnswer: formatCorrectAnswer(question.correctAnswer),
    explanation: showExplanation ? (question.explanation ?? null) : null,
  };
}
