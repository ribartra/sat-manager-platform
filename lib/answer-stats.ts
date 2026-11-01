import prisma from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { scorePercent } from "@/lib/utils";
import type { WeightedScore } from "@/lib/weighted-score";

/** Counts of one practice attempt's answer rows (same rules as lib/weighted-score). */
export interface AnswerStats {
  /** Answer rows (summarizeAllQuestionAnswers().total). */
  total: number;
  /** Rows with isCorrect === true. */
  correct: number;
  /** Rows with a non-blank answer (isAnsweredAnswer). */
  answered: number;
}

/** SQLite caps bound variables per statement; ids go in chunks well under it. */
const CHUNK = 500;

/**
 * Per practice attempt, counted in SQL with one GROUP BY: lists that only need totals (History,
 * teacher overviews) no longer load every answer row of every attempt into memory. Attempts with no
 * answer rows are absent from the map.
 */
export async function practiceAnswerStats(attemptIds: readonly string[]): Promise<Map<string, AnswerStats>> {
  const stats = new Map<string, AnswerStats>();
  const ids = [...new Set(attemptIds)];
  for (let start = 0; start < ids.length; start += CHUNK) {
    const chunk = ids.slice(start, start + CHUNK);
    const rows = await prisma.$queryRaw<Array<{ attemptId: string; total: number | bigint; correct: number | bigint | null; answered: number | bigint | null }>>(Prisma.sql`
      SELECT "attemptId",
             COUNT(*) AS total,
             SUM(CASE WHEN "isCorrect" = 1 THEN 1 ELSE 0 END) AS correct,
             SUM(CASE WHEN "answer" IS NOT NULL AND TRIM("answer", ' ' || char(9) || char(10) || char(13)) <> '' THEN 1 ELSE 0 END) AS answered
      FROM "AttemptAnswer"
      WHERE "attemptId" IN (${Prisma.join(chunk)})
      GROUP BY "attemptId"
    `);
    for (const row of rows) {
      stats.set(row.attemptId, { total: Number(row.total), correct: Number(row.correct ?? 0), answered: Number(row.answered ?? 0) });
    }
  }
  return stats;
}

export const NO_ANSWERS: AnswerStats = { total: 0, correct: 0, answered: 0 };

/** The attempt's score from its counts: same result as summarizeAllQuestionAnswers on its rows. */
export function scoreFromStats(stats: AnswerStats | undefined): WeightedScore {
  const { correct, total } = stats ?? NO_ANSWERS;
  return { correct, total, percent: total > 0 ? scorePercent(correct, total) : null };
}
