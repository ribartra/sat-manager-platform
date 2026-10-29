import prisma from "@/lib/prisma";
import { NotFoundError } from "@/lib/api-error";
import { parseTarget, QUICK_IMPORT_MODE } from "@/lib/quick-import";

/**
 * An "Import with AI" batch the session may work on: admins see every one, the master teacher only
 * the ones they started. Returns the batch, its target and its question source file (the PDF).
 */
export async function loadQuickBatch(batchId: string, user: { id: string; role: string }) {
  const batch = await prisma.ingestBatch.findUnique({ where: { id: batchId } });
  if (!batch || batch.importMode !== QUICK_IMPORT_MODE) throw new NotFoundError("Import not found.");
  if (user.role !== "ADMIN" && batch.createdById !== user.id) throw new NotFoundError("Import not found.");
  const target = parseTarget(batch.targetJson);
  if (!target) throw new NotFoundError("Import target is missing.");
  const files = await prisma.ingestSourceFile.findMany({ where: { batchId }, orderBy: { relativePath: "asc" } });
  // The questions PDF (answer / explanation files are only context for the AI and the zip).
  const questionFile = files.find((file) => file.isQuestionSource && !file.isAnswerFile && !file.isExplanationFile) ?? files[0] ?? null;
  return { batch, target, files, questionFile };
}

/** Artifacts of the "Import with AI" that created this Practice Set / Test, if any (for its editor). */
export async function importArtifactsFor(artifactId: string) {
  const artifact = await prisma.ingestPromotionArtifact.findFirst({
    where: { artifactId, artifactType: { in: ["PRACTICE_SET", "FULL_PRACTICE_TEST"] }, groupKey: { startsWith: "quick:" } },
    select: { batchId: true, sourceFileId: true },
  });
  if (!artifact) return null;
  return {
    wizardHref: `/teacher/import/${artifact.batchId}`,
    reviewHref: artifact.sourceFileId ? `/admin/import/ai/${artifact.batchId}/files/${artifact.sourceFileId}` : null,
    zipHref: `/api/import/quick/${artifact.batchId}/artifacts`,
  };
}
