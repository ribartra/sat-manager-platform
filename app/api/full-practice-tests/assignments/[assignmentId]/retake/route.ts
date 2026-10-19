import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApprovedSession } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { isUniqueConstraintError } from "@/lib/db-errors";
import { buildFullTestSnapshot, fullTestModulesInclude } from "@/lib/full-test-snapshot";
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError, withApiErrors } from "@/lib/api-error";

interface RouteContext {
  params: Promise<{ assignmentId: string }>;
}

/**
 * Retake a finished Test (student). Starts a new attempt on the same assignment; earlier attempts and
 * their results are kept. Only one open attempt per assignment (partial unique index): if one is
 * already open it is reused.
 */
export const POST = withApiErrors(async function POST(_req: Request, { params }: RouteContext) {
  const session = await requireApprovedSession();
  if (!session) return new UnauthorizedError("Please sign in again.").toResponse();
  if (session.user.role !== "STUDENT") return new ForbiddenError("Only students can retake a test.").toResponse();

  const { assignmentId } = await params;
  const assignment = await prisma.fullPracticeTestAssignment.findFirst({
    where: { id: assignmentId, studentId: session.user.id },
    include: {
      test: { include: { modules: { include: fullTestModulesInclude, orderBy: { order: "asc" } } } },
      attempts: { where: { status: "IN_PROGRESS" }, select: { id: true }, take: 1 },
    },
  });
  if (!assignment) return new NotFoundError("Test not found.").toResponse();
  if (assignment.attempts[0]) return NextResponse.json({ ok: true, attemptId: assignment.attempts[0].id, reused: true });
  if (assignment.status !== "COMPLETED") return new ConflictError("Finish this test before retaking it.").toResponse();

  let attemptId: string;
  let reused = false;
  try {
    const created = await prisma.fullPracticeTestAttempt.create({
      data: {
        testId: assignment.testId,
        assignmentId: assignment.id,
        studentId: session.user.id,
        // RNF-17: freeze the test as it is now; later edits never change this attempt.
        testSnapshot: buildFullTestSnapshot(assignment.testId, assignment.test.modules),
      },
      select: { id: true },
    });
    attemptId = created.id;
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const open = await prisma.fullPracticeTestAttempt.findFirstOrThrow({
      where: { assignmentId: assignment.id, status: "IN_PROGRESS" },
      select: { id: true },
    });
    attemptId = open.id;
    reused = true;
  }
  await prisma.fullPracticeTestAssignment.update({ where: { id: assignment.id }, data: { status: "IN_PROGRESS" } });
  await writeAudit({
    userId: session.user.id,
    action: "FPT_RETAKE_STARTED",
    targetType: "FullPracticeTestAttempt",
    targetId: attemptId,
    outcome: "success",
    metadata: { testId: assignment.testId, assignmentId: assignment.id, reused },
  });
  return NextResponse.json({ ok: true, attemptId, reused });
});
