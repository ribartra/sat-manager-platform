/**
 * Staging warnings from OCR/ingest often go stale after a reviewer fills fields.
 * Reconcile before display/save so "answer missing" does not stay amber forever.
 */

export const MISSING_CORRECT_ANSWER_WARNING = "The correct answer is missing.";
/** Soft note once the ingest gap has been filled — shown as info, not a problem. */
export const RECTIFIED_CORRECT_ANSWER_INFO = "Correct answer was filled in after ingest.";

const MISSING_ANSWER_RE = /^The correct answer is missing\.?$/i;
const RECTIFIED_ANSWER_RE = /^Correct answer was filled in after ingest\.?$/i;
const IMAGE_ANSWER_HINT_RE =
  /^Answer looks like an image; check that the numeric answer is set\.?$/i;

export function parseIngestWarningsJson(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((item) => String(item ?? "").trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function isIngestWarningInfo(message: string): boolean {
  return RECTIFIED_ANSWER_RE.test(message.trim());
}

export function reconcileIngestWarnings(
  warnings: string[],
  opts: { correctAnswer?: string | null },
): { warnings: string[]; info: string[] } {
  const hasAnswer = Boolean(opts.correctAnswer?.trim());
  const warnOut: string[] = [];
  const infoOut: string[] = [];
  let hadMissingAnswerWarning = false;

  for (const raw of warnings) {
    const warning = String(raw ?? "").trim();
    if (!warning) continue;

    if (MISSING_ANSWER_RE.test(warning)) {
      hadMissingAnswerWarning = true;
      if (!hasAnswer) warnOut.push(MISSING_CORRECT_ANSWER_WARNING);
      continue;
    }

    if (RECTIFIED_ANSWER_RE.test(warning)) {
      if (hasAnswer) infoOut.push(RECTIFIED_CORRECT_ANSWER_INFO);
      continue;
    }

    // Obsolete once any answer (letter or numeric) is present.
    if (hasAnswer && IMAGE_ANSWER_HINT_RE.test(warning)) continue;

    warnOut.push(warning);
  }

  if (hasAnswer && hadMissingAnswerWarning) {
    infoOut.push(RECTIFIED_CORRECT_ANSWER_INFO);
  }

  return {
    warnings: [...new Set(warnOut)],
    info: [...new Set(infoOut)],
  };
}

/** Persist warnings + info notes back into warningsJson (info last). */
export function stringifyReconciledIngestWarnings(warnings: string[], info: string[]): string {
  return JSON.stringify([...warnings, ...info]);
}

export function reconcileWarningsJson(
  raw: string | null | undefined,
  opts: { correctAnswer?: string | null },
): { list: string[]; warnings: string[]; info: string[]; json: string } {
  const reconciled = reconcileIngestWarnings(parseIngestWarningsJson(raw), opts);
  const list = [...reconciled.warnings, ...reconciled.info];
  return {
    list,
    warnings: reconciled.warnings,
    info: reconciled.info,
    json: stringifyReconciledIngestWarnings(reconciled.warnings, reconciled.info),
  };
}
