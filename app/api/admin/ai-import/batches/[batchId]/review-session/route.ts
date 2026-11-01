import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { ForbiddenError, NotFoundError, withApiErrors } from "@/lib/api-error";

interface RouteContext {
  params: Promise<{ batchId: string }>;
}

export const PATCH = withApiErrors(async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return new ForbiddenError("Forbidden").toResponse();

  const { batchId } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    sourceFileId?: string | null;
    currentStep?: string;
    status?: string;
    progressJson?: string | null;
  };

  const batch = await prisma.ingestBatch.findUnique({ where: { id: batchId } });
  if (!batch) return new NotFoundError("Batch not found.").toResponse();

  const reviewSession = await prisma.ingestReviewSession.upsert({
    where: { batchId },
    create: {
      id: `review_${randomUUID().replace(/-/g, "")}`,
      batchId,
      sourceFileId: body.sourceFileId ?? null,
      currentStep: body.currentStep || "FILES",
      status: body.status || "IN_PROGRESS",
      progressJson: body.progressJson ?? null,
    },
    update: {
      ...(body.sourceFileId !== undefined ? { sourceFileId: body.sourceFileId } : {}),
      ...(body.currentStep ? { currentStep: body.currentStep } : {}),
      ...(body.status ? { status: body.status } : {}),
      ...(body.progressJson !== undefined ? { progressJson: body.progressJson } : {}),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "UPDATE_AI_IMPORT_REVIEW_SESSION",
      targetType: "IngestBatch",
      targetId: batchId,
      metadata: JSON.stringify(body),
    },
  });

  return NextResponse.json(reviewSession);
});
