import { NextRequest, NextResponse } from "next/server";
import { contentProgramFor } from "@/lib/program-scope";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { promoteCandidates } from "@/lib/ingest-promote-candidates";
import { BadRequestError, ForbiddenError, PayloadTooLargeError, withApiErrors } from "@/lib/api-error";

interface RouteContext {
  params: Promise<{ batchId: string }>;
}

type CandidatePayload = {
  candidateIds?: unknown;
  /**
   * When true, candidates already PROMOTED are re-synced into their official
   * question (guarded, never degrading) instead of being skipped — this is how
   * edits a reviewer makes AFTER promotion reach the live question. WAL-safe:
   * the write goes through the app, not an external process.
   */
  resync?: unknown;
};

export const POST = withApiErrors(async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return new ForbiddenError("Forbidden").toResponse();

  const { batchId } = await params;
  const body = (await req.json().catch(() => ({}))) as CandidatePayload;
  const candidateIds = Array.isArray(body.candidateIds)
    ? [...new Set(body.candidateIds.filter((id): id is string => typeof id === "string" && id.length > 0))]
    : [];
  if (candidateIds.length === 0) return new BadRequestError("candidateIds is required.").toResponse();
  if (candidateIds.length > 250) return new PayloadTooLargeError("Promote at most 250 questions at a time.").toResponse();
  const resync = body.resync === true;
  // New official questions go to the promoter's program bank (program = tenant).
  const programId = await contentProgramFor(session.user);

  const { promoted, resynced, skipped, errors } = await promoteCandidates({ batchId, candidateIds, resync, programId, userId: session.user.id });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "PROMOTE_AI_IMPORT_QUESTIONS",
      targetType: "IngestBatch",
      targetId: batchId,
      metadata: JSON.stringify({ requested: candidateIds.length, promoted: promoted.length, resynced: resynced.length, skipped: skipped.length, errors: errors.length }),
    },
  });

  return NextResponse.json({
    promoted: promoted.length,
    resynced: resynced.length,
    skipped: skipped.length,
    errors,
    questionIds: promoted,
    resyncedItems: resynced,
    skippedItems: skipped,
  });
});
