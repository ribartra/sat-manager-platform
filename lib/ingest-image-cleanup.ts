import prisma from "@/lib/prisma";
import {
  clearObsoleteImageWarnings,
  stripIngestImagePlaceholders,
} from "@/lib/ingest-text-sanitize";

export {
  clearObsoleteImageWarnings as clearImageMissingWarnings,
  stripIngestImagePlaceholders as stripMarkdownImages,
} from "@/lib/ingest-text-sanitize";

export function parseWarningsJson(raw: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function stringifyWarningsJson(warnings: string[]): string {
  return JSON.stringify(warnings);
}

/**
 * After a STEM image is linked: strip leftover ![…](…) and [tbl-N.html] from staging
 * (+ official if promoted) and drop obsolete image/table warnings so Extracted Test
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

  const nextStem = stripIngestImagePlaceholders(candidate.stem);
  const nextStimulus = stripIngestImagePlaceholders(candidate.stimulus);
  const prevWarnings = parseWarningsJson(candidate.warningsJson);
  const nextWarnings = clearObsoleteImageWarnings(prevWarnings);
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

  if (candidate.officialQuestionId) {
    await cleanupOfficialQuestionPlaceholders(candidate.officialQuestionId);
  }
}

/** Strip image/table placeholders from an official Question once it has an imageUrl. */
export async function cleanupOfficialQuestionPlaceholders(questionId: string): Promise<void> {
  const official = await prisma.question.findUnique({
    where: { id: questionId },
    select: { id: true, stem: true, stimulus: true, imageUrl: true },
  });
  if (!official?.imageUrl?.trim()) return;

  const officialStem = stripIngestImagePlaceholders(official.stem);
  const officialStimulus = stripIngestImagePlaceholders(official.stimulus);
  if (officialStem !== (official.stem ?? "").trim() || officialStimulus !== (official.stimulus ?? "").trim()) {
    await prisma.question.update({
      where: { id: official.id },
      data: {
        stem: officialStem || official.stem,
        stimulus: officialStimulus || null,
      },
    });
  }

  // Keep staging rows that map to this official question in sync.
  const siblings = await prisma.ingestQuestionCandidate.findMany({
    where: { officialQuestionId: questionId },
    select: { id: true, stem: true, stimulus: true, warningsJson: true },
  });
  for (const sibling of siblings) {
    const nextStem = stripIngestImagePlaceholders(sibling.stem);
    const nextStimulus = stripIngestImagePlaceholders(sibling.stimulus);
    const prevWarnings = parseWarningsJson(sibling.warningsJson);
    const nextWarnings = clearObsoleteImageWarnings(prevWarnings);
    const stemChanged = nextStem !== (sibling.stem ?? "").trim();
    const stimulusChanged = nextStimulus !== (sibling.stimulus ?? "").trim();
    const warningsChanged = stringifyWarningsJson(nextWarnings) !== stringifyWarningsJson(prevWarnings);
    if (!stemChanged && !stimulusChanged && !warningsChanged) continue;
    await prisma.ingestQuestionCandidate.update({
      where: { id: sibling.id },
      data: {
        ...(stemChanged ? { stem: nextStem || null } : {}),
        ...(stimulusChanged ? { stimulus: nextStimulus || null } : {}),
        ...(warningsChanged ? { warningsJson: stringifyWarningsJson(nextWarnings) } : {}),
      },
    });
  }
}
