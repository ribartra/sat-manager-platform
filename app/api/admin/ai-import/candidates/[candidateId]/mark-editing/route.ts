import { NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ candidateId: string }>;
}

export async function POST(_req: Request, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
}
