import { OPERATIVE_RAW_MAX, scaledScore, type SatSection } from "@/lib/full-test-scoring";
import { scorePercent as pctOf } from "@/lib/utils";

export type PracticeSetScoreResult = {
  scorePercent: number;
  scaledScore: number;
  scoreSection: SatSection;
  rawEquiv: number;
};

/** Map taxonomy section name/label to SAT RW | MATH. */
export function satSectionFromTopicSection(section?: {
  name?: string | null;
  label?: string | null;
} | null): SatSection {
  const text = `${section?.name ?? ""} ${section?.label ?? ""}`.toLowerCase();
  if (text.includes("math")) return "MATH";
  return "RW";
}

/**
 * Estimate a SAT-style section score (200–800) for a Practice Set attempt.
 * Maps correct/total onto the FPT operative raw curve for that section.
 */
export async function scorePracticeSetAttempt(input: {
  correct: number;
  total: number;
  section?: { name?: string | null; label?: string | null } | null;
  scoreSection?: SatSection | string | null;
}): Promise<PracticeSetScoreResult> {
  const scoreSection =
    input.scoreSection === "MATH" || input.scoreSection === "RW"
      ? input.scoreSection
      : satSectionFromTopicSection(input.section);
  const total = Math.max(0, input.total);
  const correct = Math.max(0, Math.min(input.correct, total));
  const scorePercent = pctOf(correct, total);
  const maxRaw = OPERATIVE_RAW_MAX[scoreSection];
  const rawEquiv = total > 0 ? Math.round((correct / total) * maxRaw) : 0;
  const score = await scaledScore(scoreSection, rawEquiv, maxRaw);
  return { scorePercent, scaledScore: score, scoreSection, rawEquiv };
}

/** Prefer persisted columns; otherwise recompute from answers + section metadata. */
export async function resolvePracticeSetAttemptScore(input: {
  scorePercent?: number | null;
  scaledScore?: number | null;
  scoreSection?: string | null;
  correct: number;
  total: number;
  section?: { name?: string | null; label?: string | null } | null;
}): Promise<PracticeSetScoreResult> {
  if (
    typeof input.scorePercent === "number" &&
    typeof input.scaledScore === "number" &&
    (input.scoreSection === "RW" || input.scoreSection === "MATH")
  ) {
    return {
      scorePercent: input.scorePercent,
      scaledScore: input.scaledScore,
      scoreSection: input.scoreSection,
      rawEquiv: Math.round((input.correct / Math.max(input.total, 1)) * OPERATIVE_RAW_MAX[input.scoreSection]),
    };
  }
  return scorePracticeSetAttempt(input);
}

/** Running / cumulative average of scaled scores (ignores nulls). */
export function averageScaledScores(scores: Array<number | null | undefined>): number | null {
  const values = scores.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

/**
 * Chronological cumulative averages: for each attempt in time order,
 * average of scaledScore from the first attempt through that point.
 */
export function cumulativeAverageSeries(
  attempts: Array<{ scaledScore: number | null | undefined; submittedAt?: Date | string | null }>,
): Array<{ at: Date | null; average: number; score: number }> {
  const ordered = [...attempts].sort((a, b) => {
    const aTime = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
    const bTime = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
    return aTime - bTime;
  });
  const series: Array<{ at: Date | null; average: number; score: number }> = [];
  const seen: number[] = [];
  for (const attempt of ordered) {
    if (typeof attempt.scaledScore !== "number") continue;
    seen.push(attempt.scaledScore);
    series.push({
      at: attempt.submittedAt ? new Date(attempt.submittedAt) : null,
      score: attempt.scaledScore,
      average: Math.round(seen.reduce((sum, value) => sum + value, 0) / seen.length),
    });
  }
  return series;
}
