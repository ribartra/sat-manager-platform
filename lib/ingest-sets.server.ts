import "server-only";
import prisma from "@/lib/prisma";
import type { SetRow } from "@/lib/ingest-sets";

// computeSetRows consolidates every conjunto in a batch with its
// pending-question breakdown. Shared by the standalone index
// (app/admin/import/ai/sets) and the conjunto rail embedded in the per-file
// review workspace (app/admin/import/ai/[batchId]/files/[fileId]).

function textOptionCount(optionsJson: string | null): number {
  if (!optionsJson) return 0;
  try {
    const parsed = JSON.parse(optionsJson);
    if (!Array.isArray(parsed)) return 0;
    return parsed.filter((option) => typeof option?.text === "string" && option.text.trim()).length;
  } catch {
    return 0;
  }
}

export async function computeSetRows(batchId: string): Promise<SetRow[]> {
  const [sources, candidates, imageLinks] = await Promise.all([
    prisma.ingestSourceFile.findMany({
      where: { batchId, contentType: { in: ["PRACTICE_SET", "FULL_PRACTICE_TEST"] } },
      select: {
        id: true,
        relativePath: true,
        contentType: true,
        section: true,
        topicName: true,
        difficulty: true,
        testNumber: true,
        status: true,
      },
    }),
    prisma.ingestQuestionCandidate.findMany({
      where: { batchId, contentType: { in: ["PRACTICE_SET", "FULL_PRACTICE_TEST"] } },
      select: { id: true, sourceFileId: true, type: true, correctAnswer: true, optionsJson: true, promotionStatus: true, status: true },
    }),
    prisma.ingestCandidateImageLink.findMany({
      where: { batchId },
      select: { candidateId: true, targetType: true, optionLabel: true },
    }),
  ]);

  // Per-candidate image coverage: an OPTION_BLOCK link resolves all four
  // options; individual OPTION links each cover one letter.
  const optionBlock = new Set<string>();
  const optionLetters = new Map<string, Set<string>>();
  for (const link of imageLinks) {
    if (link.targetType === "OPTION_BLOCK") {
      optionBlock.add(link.candidateId);
    } else if (link.targetType === "OPTION" && link.optionLabel) {
      const set = optionLetters.get(link.candidateId) ?? new Set<string>();
      set.add(link.optionLabel.toUpperCase());
      optionLetters.set(link.candidateId, set);
    }
  }

  const byFile = new Map<string, { total: number; sinResp: number; faltanOpt: number; promoted: number }>();
  for (const candidate of candidates) {
    if (!candidate.sourceFileId) continue;
    // Merged-away / rejected candidates no longer count toward the file.
    if (candidate.status === "REJECTED" || candidate.promotionStatus === "REJECTED") continue;
    const stat = byFile.get(candidate.sourceFileId) ?? { total: 0, sinResp: 0, faltanOpt: 0, promoted: 0 };
    stat.total += 1;
    if (candidate.promotionStatus === "PROMOTED") stat.promoted += 1;
    const optionsResolved =
      candidate.type === "NUMERIC" ||
      optionBlock.has(candidate.id) ||
      textOptionCount(candidate.optionsJson) + (optionLetters.get(candidate.id)?.size ?? 0) >= 4;
    if (!candidate.correctAnswer) {
      stat.sinResp += 1;
    } else if (!optionsResolved) {
      stat.faltanOpt += 1;
    }
    byFile.set(candidate.sourceFileId, stat);
  }

  return sources
    .map((source) => {
      const stat = byFile.get(source.id) ?? { total: 0, sinResp: 0, faltanOpt: 0, promoted: 0 };
      const pending = stat.sinResp + stat.faltanOpt;
      return {
        sourceFileId: source.id,
        batchId,
        relativePath: source.relativePath,
        title: source.topicName || source.relativePath.split("/").at(-1) || "Conjunto",
        contentType: source.contentType ?? "PRACTICE_SET",
        section: source.section,
        difficulty: source.difficulty,
        testNumber: source.testNumber,
        status: source.status,
        total: stat.total,
        answerable: stat.total - pending,
        pending,
        sinResp: stat.sinResp,
        faltanOpt: stat.faltanOpt,
        promoted: stat.promoted,
      };
    })
    .sort((a, b) => b.pending - a.pending || a.relativePath.localeCompare(b.relativePath));
}
