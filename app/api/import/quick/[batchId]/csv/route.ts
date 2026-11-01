import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertContentImporter } from "@/lib/rbac";
import { ConflictError, PayloadTooLargeError, ValidationError, withApiErrors } from "@/lib/api-error";
import { writeAudit } from "@/lib/audit";
import { loadQuickBatch } from "@/lib/quick-import.server";
import { candidateTestModule, newCandidateId, parseTestModule, readQuickImportCsv, TEST_MODULE_INFO } from "@/lib/quick-import";
import { CONTENT_JOB, exclusiveJob } from "@/lib/job-lock";

type Ctx = { params: Promise<{ batchId: string }> };

const MAX_CSV_CHARS = 5_000_000;

// POST /api/import/quick/[batchId]/csv — { csv, dryRun, module? }: step 2, the CSV made by the external AI.
// dryRun → preview (rows, errors, warnings); otherwise the valid rows replace the import's staging
// questions. A Test is loaded one module at a time (module = RW1 | RW2 | MATH1 | MATH2): the CSV then
// replaces only that module's questions, while none of them is in the Draft yet.
export const POST = withApiErrors(exclusiveJob(CONTENT_JOB, async function POST(req: NextRequest, { params }: Ctx) {
  const session = await assertContentImporter();
  const { batchId } = await params;
  const { batch, target, questionFile, moduleFile } = await loadQuickBatch(batchId, session.user);
  const body = (await req.json().catch(() => null)) as { csv?: unknown; dryRun?: unknown; module?: unknown } | null;
  const onlyModule = target.kind === "FULL_PRACTICE_TEST" ? parseTestModule(body?.module) : null;
  if (body?.module != null && target.kind === "FULL_PRACTICE_TEST" && !onlyModule) throw new ValidationError("Validation failed.", ["Unknown module."]);
  const moduleInfo = onlyModule ? TEST_MODULE_INFO[onlyModule] : null;
  const csv = typeof body?.csv === "string" ? body.csv : "";
  if (!csv.trim()) throw new ValidationError("Validation failed.", ["Upload the CSV file the AI made."]);
  if (csv.length > MAX_CSV_CHARS) throw new PayloadTooLargeError("The CSV is too large.");

  const { rows, missingColumns } = readQuickImportCsv(csv, target, onlyModule);
  if (missingColumns.length) throw new ValidationError("Validation failed.", [`The CSV is missing the column(s): ${missingColumns.join(", ")}. Use the header from the prompt.`]);
  const valid = rows.filter((row) => row.errors.length === 0);
  const preview = {
    module: onlyModule,
    expected: moduleInfo?.expected ?? null,
    total: rows.length,
    valid: valid.length,
    ready: valid.filter((row) => row.candidate.status === "READY").length,
    rows: rows.map((row) => ({ rowNumber: row.rowNumber, number: row.number, module: row.candidate.moduleLabel ? `${row.candidate.section}${row.candidate.moduleLabel}` : null, errors: row.errors, warnings: row.warnings, stem: (row.candidate.stem ?? "").slice(0, 140) })),
  };
  if (body?.dryRun !== false) return NextResponse.json({ ...preview, dryRun: true });

  // Each module is staged against its own questions file (so Review crops from the right PDF).
  const sourceFile = onlyModule ? moduleFile(onlyModule) : questionFile;
  if (!sourceFile) throw new ValidationError("Validation failed.", [moduleInfo ? `This import has no questions file for ${moduleInfo.name}.` : "The import has no PDF."]);
  if (valid.length === 0) throw new ValidationError("Validation failed.", ["No valid row to import."]);

  // What this CSV replaces: the whole import, or only the chosen module's questions.
  const existing = await prisma.ingestQuestionCandidate.findMany({ where: { batchId }, select: { id: true, section: true, moduleLabel: true, promotionStatus: true } });
  const replaced = onlyModule ? existing.filter((c) => candidateTestModule(c) === onlyModule) : existing;
  if (replaced.some((c) => c.promotionStatus === "PROMOTED")) {
    throw new ConflictError(
      moduleInfo
        ? `${moduleInfo.name} is already in the Draft: fix its questions in the Test editor (figures can still be cropped in Review).`
        : "This import already created its Draft; start a new import to load another CSV.",
    );
  }
  const replacedIds = replaced.map((c) => c.id);

  await prisma.$transaction([
    prisma.ingestCandidateImageLink.deleteMany({ where: { batchId, candidateId: { in: replacedIds } } }),
    prisma.ingestQuestionCandidate.deleteMany({ where: { batchId, id: { in: replacedIds } } }),
    prisma.ingestQuestionCandidate.createMany({
      data: valid.map((row) => ({
        id: newCandidateId(),
        batchId,
        sourceFileId: sourceFile.id,
        sourceLabel: "AI CSV",
        answerSource: "AI_CSV",
        confidence: row.candidate.status === "READY" ? 0.9 : 0.6,
        ...row.candidate,
      })),
    }),
    prisma.ingestBatch.update({ where: { id: batchId }, data: { candidatesDetected: existing.length - replacedIds.length + valid.length } }),
  ]);
  await writeAudit({
    userId: session.user.id,
    action: "QUICK_IMPORT_CSV_LOADED",
    targetType: "IngestBatch",
    targetId: batch.id,
    metadata: { rows: rows.length, imported: valid.length, ready: preview.ready, module: onlyModule },
  });
  return NextResponse.json({ ...preview, dryRun: false });
}));
