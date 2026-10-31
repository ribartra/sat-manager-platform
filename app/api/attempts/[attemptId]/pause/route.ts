import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApprovedSession } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { withSqliteRetry } from "@/lib/sqlite-retry";
import { isUniqueConstraintError } from "@/lib/db-errors";
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

  const existing = await withSqliteRetry(() => prisma.attemptPause.findFirst({
    where: { attemptId, resumedAt: null },
    orderBy: { pausedAt: "desc" },
  }));
  if (existing) return NextResponse.json(existing);

  let pause;
  try {
    pause = await withSqliteRetry(() => prisma.attemptPause.create({ data: { attemptId } }));
  } catch (error) {
    // One open pause per attempt (unique index): a concurrent pause (double click, two tabs) won.
    if (!isUniqueConstraintError(error)) throw error;
    return NextResponse.json(await prisma.attemptPause.findFirst({ where: { attemptId, resumedAt: null } }));
  }
  await writeAudit({
    userId: session.user.id,
    action: "ATTEMPT_PAUSED",
    targetType: "Attempt",
    targetId: attemptId,
    outcome: "info",
  });
  return NextResponse.json(pause);
});
