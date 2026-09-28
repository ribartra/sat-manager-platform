import { scorePercent } from "@/lib/utils";

export type AnswerScoreLike = {
  answer?: string | null;
  isCorrect?: boolean | null;
};

export type AnswerTimeLike = AnswerScoreLike & {
  timeSpent?: number | null;
};

export type AttemptElapsedTimeLike = {
  totalTime?: number | null;
};

export type WeightedScore = {
  correct: number;
  total: number;
  percent: number | null;
};

/** Reporting-only predicate: unanswered rows must not dilute accuracy. */
export function isAnsweredAnswer(answer: AnswerScoreLike): boolean {
  return typeof answer.answer === "string" && answer.answer.trim().length > 0;
}

/** Weighted accuracy across question rows, never an average of attempt percentages. */
export function summarizeWeightedAnswers(answers: readonly AnswerScoreLike[]): WeightedScore {
  const answered = answers.filter(isAnsweredAnswer);
  const correct = answered.filter((answer) => answer.isCorrect === true).length;
  const total = answered.length;
  return { correct, total, percent: total > 0 ? scorePercent(correct, total) : null };
}

/** Score across every question row in scope; blank answers count in the denominator. */
export function summarizeAllQuestionAnswers(answers: readonly AnswerScoreLike[]): WeightedScore {
  const correct = answers.filter((answer) => answer.isCorrect === true).length;
  const total = answers.length;
  return { correct, total, percent: total > 0 ? scorePercent(correct, total) : null };
}

/** Time spent answering questions, excluding navigation, pauses and idle player time. */
export function sumAnsweredTime(answers: readonly AnswerTimeLike[]): number {
  return answers
    .filter(isAnsweredAnswer)
    .reduce((total, answer) => total + Math.max(0, answer.timeSpent ?? 0), 0);
}

/** Authoritative elapsed time for submitted attempts, including empty submissions. */
export function sumAttemptElapsedTime(attempts: readonly AttemptElapsedTimeLike[]): number {
  return attempts.reduce((total, attempt) => total + Math.max(0, attempt.totalTime ?? 0), 0);
}
