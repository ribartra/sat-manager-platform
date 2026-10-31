import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertContentImporter } from "@/lib/rbac";
import { ConflictError, PayloadTooLargeError, ValidationError, withApiErrors } from "@/lib/api-error";
import { writeAudit } from "@/lib/audit";
import { loadQuickBatch } from "@/lib/quick-import.server";
import { newCandidateId, readQuickImportCsv } from "@/lib/quick-import";
import { CONTENT_JOB, exclusiveJob } from "@/lib/job-lock";

type Ctx = { params: Promise<{ batchId: string }> };

const MAX_CSV_CHARS = 5_000_000;

// POST /api/import/quick/[batchId]/csv — { csv, dryRun }: step 2, the CSV made by the external AI.
// dryRun → preview (rows, errors, warnings); otherwise the valid rows replace the import's staging
// questions (only while nothing has been turned into a Draft yet).
export const POST = withApiErrors(exclusiveJob(CONTENT_JOB, async function POST(req: NextRequest, { params }: Ctx) {
  const session = await assertContentImporter();
  const { batchId } = await params;
  const { batch, target, questionFile } = await loadQuickBatch(batchId, session.user);
  const body = (await req.json().catch(() => null)) as { csv?: unknown; dryRun?: unknown } | null;
  const csv = typeof body?.csv === "string" ? body.csv : "";
  if (!csv.trim()) throw new ValidationError("Validation failed.", ["Upload the CSV file the AI made."]);
  if (csv.length > MAX_CSV_CHARS) throw new PayloadTooLargeError("The CSV is too large.");

  const { rows, missingColumns } = readQuickImportCsv(csv, target);
  if (missingColumns.length) throw new ValidationError("Validation failed.", [`The CSV is missing the column(s): ${missingColumns.join(", ")}. Use the header from the prompt.`]);
  const valid = rows.filter((row) => row.errors.length === 0);
  const preview = {
    total: rows.length,
    valid: valid.length,
    ready: valid.filter((row) => row.candidate.status === "READY").length,
    rows: rows.map((row) => ({ rowNumber: row.rowNumber, number: row.number, module: row.candidate.moduleLabel ? `${row.candidate.section}${row.candidate.moduleLabel}` : null, errors: row.errors, warnings: row.warnings, stem: (row.candidate.stem ?? "").slice(0, 140) })),
  };
  if (body?.dryRun !== false) return NextResponse.json({ ...preview, dryRun: true });

  if (!questionFile) throw new ValidationError("Validation failed.", ["The import has no PDF."]);
  if (valid.length === 0) throw new ValidationError("Validation failed.", ["No valid row to import."]);
  const promoted = await prisma.ingestQuestionCandidate.count({ where: { batchId, promotionStatus: "PROMOTED" } });
  if (promoted > 0) throw new ConflictError("This import already created its Draft; start a new import to load another CSV.");

  await prisma.$transaction([
    prisma.ingestCandidateImageLink.deleteMany({ where: { batchId } }),
    prisma.ingestQuestionCandidate.deleteMany({ where: { batchId } }),
    prisma.ingestQuestionCandidate.createMany({
      data: valid.map((row) => ({
        id: newCandidateId(),
        batchId,
        sourceFileId: questionFile.id,
        sourceLabel: "AI CSV",
        answerSource: "AI_CSV",
        confidence: row.candidate.status === "READY" ? 0.9 : 0.6,
        ...row.candidate,
      })),
    }),
    prisma.ingestBatch.update({ where: { id: batchId }, data: { candidatesDetected: valid.length } }),
  ]);
  await writeAudit({
    userId: session.user.id,
    action: "QUICK_IMPORT_CSV_LOADED",
    targetType: "IngestBatch",
    targetId: batch.id,
    metadata: { rows: rows.length, imported: valid.length, ready: preview.ready },
  });
  return NextResponse.json({ ...preview, dryRun: false });
}));
