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

export type OpenQuickImport = {
  id: string;
  href: string;
  createdAt: Date;
  kind: "PRACTICE_SET" | "FULL_PRACTICE_TEST";
  /** "Innovator · TEST 9" or "Linear Equations in Two Variables · Easy" (with the source). */
  label: string;
  sourceId: string | null;
  testNumber: number | null;
  topicId: string | null;
  difficulty: string | null;
  questionsLoaded: number;
  /** A Test's Draft already exists but questions are still out of it (they need review): "Add N to the Draft". */
  draft: { href: string; notInDraft: number } | null;
};

/**
 * "Import with AI" runs still open: created by this user (admin: anyone) and either with no Draft yet
 * (the promotion artifact `quick:<batchId>`), or a Test whose Draft is still a Draft with questions left
 * out (they needed review; "Add N to the Draft" adds them later). Everything is saved as it goes, so an
 * interrupted import is continued from here (Step 1, Tests, the Test page) instead of starting another.
 */
export async function openQuickImports(user: { id: string; role: string }): Promise<OpenQuickImport[]> {
  const batches = await prisma.ingestBatch.findMany({
    where: { importMode: QUICK_IMPORT_MODE, ...(user.role === "ADMIN" ? {} : { createdById: user.id }) },
    select: { id: true, createdAt: true, sourceId: true, targetJson: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  if (batches.length === 0) return [];
  const ids = batches.map((batch) => batch.id);
  const [promoted, loaded, outOfDraft, sources] = await Promise.all([
    prisma.ingestPromotionArtifact.findMany({ where: { groupKey: { in: ids.map((id) => `quick:${id}`) } }, select: { batchId: true, artifactType: true, artifactId: true } }),
    prisma.ingestQuestionCandidate.groupBy({ by: ["batchId"], where: { batchId: { in: ids }, status: { not: "REJECTED" } }, _count: { _all: true } }),
    prisma.ingestQuestionCandidate.groupBy({ by: ["batchId"], where: { batchId: { in: ids }, status: { not: "REJECTED" }, promotionStatus: { not: "PROMOTED" } }, _count: { _all: true } }),
    prisma.source.findMany({ where: { id: { in: batches.flatMap((batch) => (batch.sourceId ? [batch.sourceId] : [])) } }, select: { id: true, name: true } }),
  ]);
  const draftTests = await prisma.fullPracticeTest.findMany({
    where: { id: { in: promoted.filter((row) => row.artifactType === "FULL_PRACTICE_TEST").map((row) => row.artifactId) }, status: "DRAFT" },
    select: { id: true },
  });
  const openDraft = new Set(draftTests.map((test) => test.id));
  const artifactBy = new Map(promoted.map((row) => [row.batchId, row]));
  const loadedBy = new Map(loaded.map((row) => [row.batchId, row._count._all]));
  const outBy = new Map(outOfDraft.map((row) => [row.batchId, row._count._all]));
  const sourceName = new Map(sources.map((source) => [source.id, source.name]));
  const level = (difficulty: string) => difficulty.charAt(0) + difficulty.slice(1).toLowerCase();
  return batches.flatMap((batch) => {
    const target = parseTarget(batch.targetJson);
    if (!target) return [];
    const artifact = artifactBy.get(batch.id);
    const notInDraft = outBy.get(batch.id) ?? 0;
    // Done: a Draft exists and nothing can be added to it (a Practice Set Draft is final; a Test's is
    // open while it is a Draft and questions are still out).
    if (artifact && !(artifact.artifactType === "FULL_PRACTICE_TEST" && openDraft.has(artifact.artifactId) && notInDraft > 0)) return [];
    const source = batch.sourceId ? sourceName.get(batch.sourceId) ?? null : null;
    const what = target.kind === "FULL_PRACTICE_TEST"
      ? target.testNumber ? `TEST ${target.testNumber}` : target.testName
      : `${target.topicName} · ${level(target.difficulty)}`;
    return [{
      id: batch.id,
      href: `/teacher/import/${batch.id}`,
      createdAt: batch.createdAt,
      kind: target.kind,
      label: source ? `${source} · ${what}` : what,
      sourceId: batch.sourceId,
      testNumber: target.kind === "FULL_PRACTICE_TEST" ? target.testNumber ?? null : null,
      topicId: target.kind === "PRACTICE_SET" ? target.topicId : null,
      difficulty: target.kind === "PRACTICE_SET" ? target.difficulty : null,
      questionsLoaded: loadedBy.get(batch.id) ?? 0,
      draft: artifact ? { href: `/teacher/tests/${artifact.artifactId}?edit`, notInDraft } : null,
    }];
  });
}

/** The import a Draft Test came from, while questions of it are still out of the Draft (for "Continue"). */
export async function importOfDraftTest(testId: string, user: { id: string; role: string }) {
  const artifact = await prisma.ingestPromotionArtifact.findFirst({
    where: { artifactType: "FULL_PRACTICE_TEST", artifactId: testId, groupKey: { startsWith: "quick:" } },
    select: { batchId: true },
  });
  if (!artifact) return null;
  const open = (await openQuickImports(user)).find((item) => item.id === artifact.batchId);
  return open?.draft ? { href: open.href, notInDraft: open.draft.notInDraft } : null;
}
