import { formatCorrectAnswer, isAnswerCorrect } from "@/lib/answer-grading";
import { resolveQuestionType } from "@/lib/question-type";
import { parseSnapshot, type QuestionSnapshot } from "@/lib/attempt-snapshots";

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

/** Grades against the attempt's question snapshot when present, so a later edit does not change it. */
export function gradeCheck(
  answer: string | null | undefined,
  question: GradableQuestion,
  questionSnapshot?: string | null,
): CheckResult {
  const snapshot = parseSnapshot<QuestionSnapshot>(questionSnapshot);
  const correctAnswer = snapshot?.correctAnswer ?? question.correctAnswer;
  const options = snapshot?.options?.length ? snapshot.options : question.options;
  return {
    isCorrect: isAnswerCorrect(answer, correctAnswer, resolveQuestionType(snapshot?.type ?? question.type, options)),
    answerKey: correctAnswer,
    correctAnswer: formatCorrectAnswer(correctAnswer),
    explanation: (snapshot ? snapshot.explanation : question.explanation) ?? null,
  };
}
