export type SatSection = "RW" | "MATH";

/** Caps when every question counts (FPT_PRETEST_EXCLUSION off — default). */
export const FULL_RAW_MAX = { RW: 54, MATH: 44 } as const;

/** Caps when pretest items are excluded from score (FPT_PRETEST_EXCLUSION on). */
export const PRETEST_EXCLUDED_RAW_MAX = { RW: 50, MATH: 40 } as const;

/** @deprecated Prefer FULL_RAW_MAX / PRETEST_EXCLUDED_RAW_MAX; defaults to full (all questions). */
export const OPERATIVE_RAW_MAX = FULL_RAW_MAX;

export function rawMaxForPretestExclusion(excludePretest: boolean) {
  return excludePretest ? PRETEST_EXCLUDED_RAW_MAX : FULL_RAW_MAX;
}

/**
 * Section score (200–800) as the share of counted questions answered correctly:
 * 200 + 600 × correct ÷ counted, rounded to the nearest 10.
 * `counted` is the number of questions that count toward the score (all of them, or
 * without the pretest items when FPT_PRETEST_EXCLUSION is on), so the scale always
 * reaches 800 exactly at a perfect section.
 *
 * The official Digital SAT uses adaptive, form-specific (IRT) scoring; without the
 * official table for each test this proportional estimate is used instead. The former
 * editable conversion table (FullPracticeTestScoreConversion) encoded the same line for
 * 50/40 counted items and is no longer read.
 */
export function sectionScore(correct: number, counted: number) {
  if (!counted || counted <= 0) return 200;
  const ratio = Math.min(Math.max(correct / counted, 0), 1);
  return Math.round((200 + 600 * ratio) / 10) * 10;
}

/** Convert raw correct to a 200–800 section score over the counted items (`total`). */
export async function scaledScore(_section: SatSection, correct: number, total: number) {
  return sectionScore(correct, total);
}

/** Worked examples shown on the teacher scoring page, per section, for one counting mode. */
export function scoringExamples(excludePretest: boolean) {
  const counted = rawMaxForPretestExclusion(excludePretest);
  const shares = [0, 0.25, 0.5, 0.6, 0.75, 0.9, 1];
  return (["RW", "MATH"] as const).map((section) => ({
    section,
    counted: counted[section],
    rows: shares.map((share) => {
      const correct = Math.round(share * counted[section]);
      return { correct, percent: Math.round((correct / counted[section]) * 100), score: sectionScore(correct, counted[section]) };
    }),
  }));
}
