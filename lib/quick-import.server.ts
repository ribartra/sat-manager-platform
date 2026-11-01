import prisma from "@/lib/prisma";
import { NotFoundError } from "@/lib/api-error";
import { parseTarget, QUICK_IMPORT_MODE, sectionOfFile } from "@/lib/quick-import";

/**
 * An "Import with AI" batch the session may work on: admins see every one, the master teacher only
 * the ones they started. Returns the batch, its target, its question source file (the PDF) and, for a
 * Test, the questions PDF of each section.
 */
export async function loadQuickBatch(batchId: string, user: { id: string; role: string }) {
  const batch = await prisma.ingestBatch.findUnique({ where: { id: batchId } });
  if (!batch || batch.importMode !== QUICK_IMPORT_MODE) throw new NotFoundError("Import not found.");
  if (user.role !== "ADMIN" && batch.createdById !== user.id) throw new NotFoundError("Import not found.");
  const target = parseTarget(batch.targetJson);
  if (!target) throw new NotFoundError("Import target is missing.");
  const files = await prisma.ingestSourceFile.findMany({ where: { batchId }, orderBy: { relativePath: "asc" } });
  // The questions PDF (answer / explanation files are only context for the AI and the zip).
  // A Test brings one questions PDF per section (named with SECTION_FILE_PREFIX at upload).
  const sectionFiles = { RW: files.find((file) => sectionOfFile(file.relativePath) === "RW") ?? null, MATH: files.find((file) => sectionOfFile(file.relativePath) === "MATH") ?? null };
  const questionFile =
    sectionFiles.RW ?? sectionFiles.MATH ?? files.find((file) => file.isQuestionSource && !file.isAnswerFile && !file.isExplanationFile) ?? files[0] ?? null;
  return { batch, target, files, questionFile, sectionFiles };
}

