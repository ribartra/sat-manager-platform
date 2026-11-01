import { NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { ForbiddenError, withApiErrors } from "@/lib/api-error";

interface RouteContext {
  params: Promise<{ candidateId: string }>;
}

export const POST = withApiErrors(async function POST(_req: Request, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return new ForbiddenError("Forbidden").toResponse();

  const { candidateId } = await params;
  const candidate = await prisma.ingestQuestionCandidate.update({
    where: { id: candidateId },
    data: { promotionStatus: "EDITING" },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "MARK_AI_IMPORT_CANDIDATE_EDITING",
      targetType: "IngestQuestionCandidate",
      targetId: candidateId,
      metadata: JSON.stringify({ batchId: candidate.batchId, sourceFileId: candidate.sourceFileId }),
    },
  });

  return NextResponse.json(candidate);
});
