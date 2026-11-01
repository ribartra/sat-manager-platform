import prisma from "@/lib/prisma";
import { NotFoundError } from "@/lib/api-error";
import { moduleQuestionFileId, parseTarget, QUICK_IMPORT_MODE, questionFileIds, type TestModuleCode } from "@/lib/quick-import";

/**
 * An "Import with AI" batch the session may work on: admins see every one, the master teacher only
 * the ones they started. Returns the batch, its target, its files and its (first) questions file.
 * What each file is comes from the slots chosen in step 1 (target.files, by file id), never from its
 * name or path.
 */
export async function loadQuickBatch(batchId: string, user: { id: string; role: string }) {
  const batch = await prisma.ingestBatch.findUnique({ where: { id: batchId } });
  if (!batch || batch.importMode !== QUICK_IMPORT_MODE) throw new NotFoundError("Import not found.");
  if (user.role !== "ADMIN" && batch.createdById !== user.id) throw new NotFoundError("Import not found.");
  const target = parseTarget(batch.targetJson);
  if (!target) throw new NotFoundError("Import target is missing.");
  const files = await prisma.ingestSourceFile.findMany({ where: { batchId }, orderBy: { relativePath: "asc" } });
  const byId = new Map(files.map((file) => [file.id, file]));
  // Imports made before slots were recorded: the first file flagged as questions.
  const legacy = files.find((file) => file.isQuestionSource && !file.isAnswerFile && !file.isExplanationFile) ?? files[0] ?? null;
  const questionFile = questionFileIds(target).map((id) => byId.get(id)).find(Boolean) ?? legacy;
  /** The questions file a Test module is read from (falls back to the import's questions file). */
  const moduleFile = (code: TestModuleCode) => {
    const id = moduleQuestionFileId(target, code);
    return id ? byId.get(id) ?? null : target.files ? null : legacy;
  };
  return { batch, target, files, questionFile, moduleFile };
}
