import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApprovedSession } from "@/lib/rbac";
import { log, REQUEST_ID_HEADER } from "@/lib/observability";
import { finalizeFullTestAttempt } from "@/lib/full-test-grading";
import { NotFoundError, UnauthorizedError, withApiErrors } from "@/lib/api-error";

interface RouteContext {
  params: Promise<{ attemptId: string }>;
}

/** Whole-test submit (all remaining modules at once). Grading lives in lib/full-test-grading.ts. */
export const POST = withApiErrors(async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await requireApprovedSession();
  if (!session) return new UnauthorizedError("Please sign in again.").toResponse();

  const { attemptId } = await params;
  const body = await req.json();
  const attempt = await prisma.fullPracticeTestAttempt.findFirst({
    where: { id: attemptId, studentId: session.user.id, status: "IN_PROGRESS" },
  });
  if (!attempt) return new NotFoundError("This test was already submitted or closed by your teacher.").toResponse();

  const result = await finalizeFullTestAttempt({ attempt, body, student: { id: session.user.id, name: session.user.name } });

  log.info("attempt.submit", {
    kind: "full_test",
    attemptId,
    userId: session.user.id,
    testId: attempt.testId,
    snapshot: Boolean(attempt.testSnapshot),
    totalScore: result.scores.totalScore,
    requestId: req.headers.get(REQUEST_ID_HEADER) ?? undefined,
  });

  return NextResponse.json({ ok: true, ...result });
});
