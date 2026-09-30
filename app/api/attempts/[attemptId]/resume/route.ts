import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApprovedSession } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { withSqliteRetry } from "@/lib/sqlite-retry";
import { NotFoundError, UnauthorizedError, withApiErrors } from "@/lib/api-error";

interface RouteContext {
  params: Promise<{ attemptId: string }>;
}

export const POST = withApiErrors(async function POST(_req: Request, { params }: RouteContext) {
  const session = await requireApprovedSession();
  if (!session) return new UnauthorizedError("Unauthorized").toResponse();

  const { attemptId } = await params;
  const attempt = await withSqliteRetry(() => prisma.attempt.findFirst({
    where: { id: attemptId, studentId: session.user.id, status: "IN_PROGRESS" },
    select: { id: true },
  }));
  if (!attempt) return new NotFoundError("Attempt not found.").toResponse();

  const pause = await withSqliteRetry(() => prisma.attemptPause.findFirst({
    where: { attemptId, resumedAt: null },
    orderBy: { pausedAt: "desc" },
  }));
  if (!pause) return NextResponse.json({ ok: true, resumed: false });

  const resumedAt = new Date();
  const durationSeconds = Math.max(0, Math.round((resumedAt.getTime() - pause.pausedAt.getTime()) / 1000));
  const updated = await withSqliteRetry(() => prisma.attemptPause.update({
    where: { id: pause.id },
    data: { resumedAt, durationSeconds },
  }));
  await writeAudit({
    userId: session.user.id,
    action: "ATTEMPT_RESUMED",
    targetType: "Attempt",
    targetId: attemptId,
    outcome: "info",
    metadata: { durationSeconds },
  });
  return NextResponse.json({ ok: true, resumed: true, pause: updated });
});
