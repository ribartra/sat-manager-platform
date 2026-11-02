import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { notifyStudentTeachers } from "@/lib/notifications";
import { requireApprovedSession } from "@/lib/rbac";
import { applyPracticeProgression } from "@/lib/practice-progression";
import { markUserActive } from "@/lib/activity";
import { gradeAndSubmitPracticeAttempt } from "@/lib/practice-attempt-submit";
import { isScoredContext } from "@/lib/assignment-context";
import { writeAudit } from "@/lib/audit";
import { log, REQUEST_ID_HEADER } from "@/lib/observability";
import { NotFoundError, UnauthorizedError, withApiErrors } from "@/lib/api-error";

export const POST = withApiErrors(async function POST(req: NextRequest, { params }: { params: Promise<{ attemptId: string }> }) {
  const session = await requireApprovedSession();
  if (!session) return new UnauthorizedError("Please sign in again.").toResponse();

  const { attemptId } = await params;
  const { answers: submittedAnswers, totalTime, timeSpentByQuestion, markedQuestionIds, notes, eliminatedOptions } = await req.json();

  const attempt = await prisma.attempt.findFirst({
    where: { id: attemptId, studentId: session.user.id },
    include: {
      answers: true,
      assignment: { select: { context: true } },
    },
  });
  // Idempotent: a repeated submit (two tabs, a retried request) gets the same answer as the first.
  if (attempt?.status === "SUBMITTED") return NextResponse.json({ ok: true, alreadySubmitted: true });
  if (!attempt || attempt.status !== "IN_PROGRESS") return new NotFoundError("This practice set was already submitted or closed by your teacher.").toResponse();

  const { transitioned, scored, submittedAt } = await gradeAndSubmitPracticeAttempt(attempt, {
    answers: submittedAnswers,
    totalTime,
    timeSpentByQuestion,
    markedQuestionIds,
    notes,
    eliminatedOptions,
  });
  if (!transitioned) {
    const current = await prisma.attempt.findUnique({ where: { id: attemptId }, select: { status: true } });
    if (current?.status === "SUBMITTED") return NextResponse.json({ ok: true, alreadySubmitted: true });
    return new NotFoundError("This practice set was already submitted or closed by your teacher.").toResponse();
  }
  await markUserActive(session.user.id, submittedAt);

  const practiceSet = await prisma.practiceSet.findUnique({ where: { id: attempt.practiceSetId }, select: { name: true } });
  await notifyStudentTeachers(session.user.id, "Practice completed", `${session.user.name} completed ${practiceSet?.name ?? "a practice set"}.`, `/teacher/students/${session.user.id}/attempts/${attemptId}`);
  // Only Homework opens the next level (Classroom work is never scored).
  if (isScoredContext(attempt.assignment?.context)) {
    await applyPracticeProgression({
      studentId: session.user.id,
      practiceSetId: attempt.practiceSetId,
      scorePercent: scored.scorePercent,
    });
  }

  await writeAudit({
    userId: session.user.id,
    action: "ATTEMPT_SUBMITTED",
    targetType: "Attempt",
    targetId: attemptId,
    outcome: "success",
    metadata: {
      practiceSetId: attempt.practiceSetId,
      scorePercent: scored.scorePercent,
      scaledScore: scored.scaledScore,
    },
  });
  log.info("attempt.submit", {
    kind: "practice",
    attemptId,
    userId: session.user.id,
    practiceSetId: attempt.practiceSetId,
    scorePercent: scored.scorePercent,
    requestId: req.headers.get(REQUEST_ID_HEADER) ?? undefined,
  });

  return NextResponse.json({ ok: true });
});

