import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApprovedSession } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { NotFoundError, UnauthorizedError, withApiErrors } from "@/lib/api-error";

interface RouteContext {
  params: Promise<{ attemptId: string }>;
}

export const POST = withApiErrors(async function POST(_req: Request, { params }: RouteContext) {
  const session = await requireApprovedSession();
  if (!session) return new UnauthorizedError("Unauthorized").toResponse();

  const { attemptId } = await params;
  const attempt = await prisma.fullPracticeTestAttempt.findFirst({
    where: { id: attemptId, studentId: session.user.id, status: "IN_PROGRESS" },
    select: { id: true },
  });
  if (!attempt) return new NotFoundError("Attempt not found.").toResponse();

  const existing = await prisma.fullPracticeTestPause.findFirst({
    where: { attemptId, resumedAt: null },
    orderBy: { pausedAt: "desc" },
  });
  if (existing) return NextResponse.json(existing);

  const pause = await prisma.fullPracticeTestPause.create({ data: { attemptId } });
  await writeAudit({
    userId: session.user.id,
    action: "FPT_ATTEMPT_PAUSED",
    targetType: "FullPracticeTestAttempt",
    targetId: attemptId,
    outcome: "info",
  });
  return NextResponse.json(pause);
});
