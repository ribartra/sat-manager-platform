import prisma from "@/lib/prisma";

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

export interface ScoreConversionInput {
  section: string;
  rawCorrect: number;
  score: number;
}

export interface ScoreConversionRow {
  section: SatSection;
  rawCorrect: number;
  score: number;
}

export interface ValidatedScoreConversions {
  rows: ScoreConversionRow[];
  errors: string[];
  warnings: string[];
}

function isSatSection(value: string): value is SatSection {
  return value === "RW" || value === "MATH";
}

export function validateScoreConversions(
  inputRows: ScoreConversionInput[],
  options?: { excludePretest?: boolean },
): ValidatedScoreConversions {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rows: ScoreConversionRow[] = [];
  const seen = new Set<string>();
  const rawMax = rawMaxForPretestExclusion(Boolean(options?.excludePretest));

  inputRows.forEach((input, index) => {
    const rowNumber = index + 1;
    const section = String(input.section ?? "").trim().toUpperCase();
    const rawCorrect = Number(input.rawCorrect);
    const score = Number(input.score);

    if (!isSatSection(section)) {
      errors.push(`Row ${rowNumber}: section must be RW or MATH.`);
      return;
    }
    if (!Number.isInteger(rawCorrect) || rawCorrect < 0) {
      errors.push(`Row ${rowNumber}: rawCorrect must be a non-negative integer.`);
      return;
    }
    if (!Number.isInteger(score) || score < 200 || score > 800 || score % 10 !== 0) {
      errors.push(`Row ${rowNumber}: score must be a 200-800 integer in 10 point increments.`);
      return;
    }

    const key = `${section}:${rawCorrect}`;
    if (seen.has(key)) {
      errors.push(`Row ${rowNumber}: duplicate conversion for ${section} raw ${rawCorrect}.`);
      return;
    }
    seen.add(key);
    rows.push({ section, rawCorrect, score });
  });

  for (const section of ["RW", "MATH"] as const) {
    const sectionRows = rows.filter((row) => row.section === section).sort((a, b) => a.rawCorrect - b.rawCorrect);
    if (sectionRows.length === 0) {
      warnings.push(`${section}: no conversion rows configured; submissions will use approximate fallback.`);
      continue;
    }
    if (sectionRows[0].rawCorrect !== 0) {
      warnings.push(`${section}: no rawCorrect 0 row; low raw scores may be extrapolated.`);
    }
    const maxExpected = rawMax[section];
    const maxConfigured = sectionRows[sectionRows.length - 1]?.rawCorrect ?? 0;
    if (maxConfigured < maxExpected) {
      warnings.push(`${section}: max rawCorrect ${maxConfigured} < expected max ${maxExpected}.`);
    }
    for (let index = 1; index < sectionRows.length; index += 1) {
      if (sectionRows[index].score < sectionRows[index - 1].score) {
        errors.push(`${section}: scores must be non-decreasing as rawCorrect increases.`);
        break;
      }
    }
  }

  return { rows, errors, warnings };
}

/**
 * Convert raw correct to a 200–800 section score.
 * `total` should match the counted items for the active pretest setting.
 */
export async function scaledScore(section: SatSection, correct: number, total: number) {
  const rows = await prisma.fullPracticeTestScoreConversion.findMany({
    where: { section },
    orderBy: { rawCorrect: "asc" },
  });

  if (rows.length === 0) {
    if (!total) return 200;
    return Math.max(200, Math.min(800, Math.round((200 + (correct / total) * 600) / 10) * 10));
  }

  const exact = rows.find((row) => row.rawCorrect === correct);
  if (exact) return exact.score;

  const lower = [...rows].reverse().find((row) => row.rawCorrect < correct);
  const upper = rows.find((row) => row.rawCorrect > correct);

  if (!lower && upper) return upper.score;
  if (lower && !upper) return lower.score;
  if (!lower || !upper) return 200;

  const ratio = (correct - lower.rawCorrect) / Math.max(upper.rawCorrect - lower.rawCorrect, 1);
  const interpolated = lower.score + (upper.score - lower.score) * ratio;
  return Math.max(200, Math.min(800, Math.round(interpolated / 10) * 10));
}
