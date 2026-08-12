import prisma from "@/lib/prisma";

const MD_IMAGE_RE = /!\[[^\]]*]\([^)]*\)/g;
const IMAGE_WARNING_RE =
  /missing an attached image|Unresolved image|Stem\/stimulus image|image that still needs|image refs/i;

/** Remove leftover OCR markdown image refs from stem/stimulus text. */
export function stripMarkdownImages(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(MD_IMAGE_RE, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function parseWarningsJson(raw: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

/** Drop user-facing warnings that are obsolete once a STEM image is attached. */
export function clearImageMissingWarnings(warnings: string[]): string[] {
  return warnings.filter((warning) => !IMAGE_WARNING_RE.test(warning));
}

export function stringifyWarningsJson(warnings: string[]): string {
  return JSON.stringify(warnings);
}

/**
 * After a STEM image is linked: strip leftover ![…](…) from staging (+ official
 * if promoted) and drop obsolete "missing image" warnings so Extracted Test
 * attention counts can clear.
 */
export async function cleanupAfterStemImageAssigned(candidateId: string): Promise<void> {
  const candidate = await prisma.ingestQuestionCandidate.findUnique({
    where: { id: candidateId },
    select: {
      id: true,
      stem: true,
      stimulus: true,
      warningsJson: true,
      officialQuestionId: true,
    },
  });
  if (!candidate) return;

  const nextStem = stripMarkdownImages(candidate.stem);
  const nextStimulus = stripMarkdownImages(candidate.stimulus);
  const prevWarnings = parseWarningsJson(candidate.warningsJson);
  const nextWarnings = clearImageMissingWarnings(prevWarnings);
  const stemChanged = nextStem !== (candidate.stem ?? "").trim();
  const stimulusChanged = nextStimulus !== (candidate.stimulus ?? "").trim();
  const warningsChanged = stringifyWarningsJson(nextWarnings) !== stringifyWarningsJson(prevWarnings);

  if (stemChanged || stimulusChanged || warningsChanged) {
    await prisma.ingestQuestionCandidate.update({
      where: { id: candidateId },
      data: {
        ...(stemChanged ? { stem: nextStem || null } : {}),
        ...(stimulusChanged ? { stimulus: nextStimulus || null } : {}),
        ...(warningsChanged ? { warningsJson: stringifyWarningsJson(nextWarnings) } : {}),
      },
    });
  }

  if (!candidate.officialQuestionId) return;
  const official = await prisma.question.findUnique({
    where: { id: candidate.officialQuestionId },
    select: { id: true, stem: true, stimulus: true },
  });
  if (!official) return;
  const officialStem = stripMarkdownImages(official.stem);
  const officialStimulus = stripMarkdownImages(official.stimulus);
  if (officialStem !== (official.stem ?? "").trim() || officialStimulus !== (official.stimulus ?? "").trim()) {
    await prisma.question.update({
      where: { id: official.id },
      data: {
        stem: officialStem || official.stem,
        stimulus: officialStimulus || null,
      },
    });
  }
}
