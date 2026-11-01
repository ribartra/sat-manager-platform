import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApprovedSession } from "@/lib/rbac";
import { log, REQUEST_ID_HEADER } from "@/lib/observability";
import { writeAudit } from "@/lib/audit";
import { completeFullTestModule, finalizeFullTestAttempt, saveFullTestProgress } from "@/lib/full-test-grading";
import { BadRequestError, NotFoundError, UnauthorizedError, withApiErrors } from "@/lib/api-error";

interface RouteContext {
  params: Promise<{ attemptId: string; moduleIndex: string }>;
}

/**
 * Submit one module. Students may take the 4 modules in any order; a submitted module is locked.
 * When the last module comes in, the whole attempt is graded (same grading as the whole-test submit).
 */
export const POST = withApiErrors(async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await requireApprovedSession();
  if (!session) return new UnauthorizedError("Please sign in again.").toResponse();

  const { attemptId, moduleIndex: rawIndex } = await params;
  const moduleIndex = Number(rawIndex);
  const body = await req.json();
  const attempt = await prisma.fullPracticeTestAttempt.findFirst({ where: { id: attemptId, studentId: session.user.id } });
  // Idempotent: the last module sent twice (a retried request) finds the Test already graded.
  if (attempt?.status === "SUBMITTED") {
    return NextResponse.json({ ok: true, done: true, alreadySubmitted: true, scores: { rwScore: attempt.rwScore, mathScore: attempt.mathScore, totalScore: attempt.totalScore } });
  }
  if (!attempt || attempt.status !== "IN_PROGRESS") return new NotFoundError("This test was already submitted or closed by your teacher.").toResponse();

  // Save the module's final state first (answers of modules submitted earlier stay locked).
  const { modules, closed } = await saveFullTestProgress(attempt, body, session.user.id);
  // Submitted or closed by the teacher while this request was on its way.
  if (closed) return new NotFoundError("This test was already submitted or closed by your teacher.").toResponse();
  if (!Number.isInteger(moduleIndex) || moduleIndex < 0 || moduleIndex >= modules.length) {
    return new BadRequestError("Unknown module.").toResponse();
  }
  const completedModules = await completeFullTestModule(attemptId, moduleIndex, modules.length);
  await writeAudit({
    userId: session.user.id,
    action: "FPT_MODULE_SUBMITTED",
    targetType: "FullPracticeTestAttempt",
    targetId: attemptId,
    outcome: "success",
    metadata: { testId: attempt.testId, moduleIndex, completedModules },
  });

  if (completedModules.length < modules.length) {
    return NextResponse.json({ ok: true, done: false, completedModules });
  }

  // Last module: grade the whole attempt. Every module is locked now, so answers come from the database.
  const fresh = await prisma.fullPracticeTestAttempt.findUniqueOrThrow({ where: { id: attemptId } });
  const result = await finalizeFullTestAttempt({
    attempt: fresh,
    body: { timeExpiredEvents: body.timeExpiredEvents, extraTimeUsed: body.extraTimeUsed, moduleTimerState: body.moduleTimerState },
    student: { id: session.user.id, name: session.user.name },
  });
  log.info("attempt.submit", {
    kind: "full_test",
    attemptId,
    userId: session.user.id,
    testId: attempt.testId,
    snapshot: Boolean(attempt.testSnapshot),
    totalScore: result.scores.totalScore,
    requestId: req.headers.get(REQUEST_ID_HEADER) ?? undefined,
  });
  return NextResponse.json({ ok: true, done: true, completedModules, ...result });
});
