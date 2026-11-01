import { NextRequest, NextResponse } from "next/server";
import prisma, { atomic } from "@/lib/prisma";
import { requireApprovedSession } from "@/lib/rbac";
import { markUserActive } from "@/lib/activity";
import { reviewMetaByQuestion } from "@/lib/answer-review-meta";
import { withSqliteRetry } from "@/lib/sqlite-retry";
import { NotFoundError, UnauthorizedError, withApiErrors } from "@/lib/api-error";

export const POST = withApiErrors(async function POST(req: NextRequest, { params }: { params: Promise<{ attemptId: string }> }) {
  const session = await requireApprovedSession();
  if (!session) return new UnauthorizedError("Unauthorized").toResponse();

  const { attemptId } = await params;
  const body = await req.json();
  const { currentQuestion, totalTime } = body;
  // The players send only what changed since their last confirmed save (lib/player-persistence
  // autosaveDelta); a full payload (offline buffer, page-hide keepalive) works the same way.
  const answerMap: Record<string, unknown> = body.answers && typeof body.answers === "object" ? body.answers : {};
  const timeMap: Record<string, unknown> =
    body.timeSpentByQuestion && typeof body.timeSpentByQuestion === "object" ? body.timeSpentByQuestion : {};

  const attempt = await withSqliteRetry(() => prisma.attempt.findFirst({
    where: { id: attemptId, studentId: session.user.id, status: "IN_PROGRESS" },
  }));
  if (!attempt) return new NotFoundError("Not found").toResponse();

  const allowedQuestions = await withSqliteRetry(() => prisma.practiceSetQuestion.findMany({
    where: { practiceSetId: attempt.practiceSetId },
    select: { questionId: true },
  }));
  const allowedQuestionIds = new Set(allowedQuestions.map((item) => item.questionId));
  const { byQuestion: reviewMeta, markedIds } = reviewMetaByQuestion(body, allowedQuestionIds);

  // All the writes in one transaction, with the status re-read inside it: a save that arrives late (the
  // debounce, the page-hide keepalive) after the set was submitted or closed writes nothing.
  const open = await atomic(async (db) => {
    const fresh = await db.attempt.findUnique({ where: { id: attemptId }, select: { status: true } });
    if (fresh?.status !== "IN_PROGRESS") return false;
    await db.attempt.update({
      where: { id: attemptId },
      data: {
        currentQuestion: Number.isInteger(currentQuestion) ? currentQuestion : undefined,
        totalTime: Number.isFinite(totalTime) ? Math.max(0, Math.round(totalTime)) : undefined,
      },
    });

    // Answers checked with immediate feedback are locked on the server, not only in the UI.
    const lockedQuestionIds = new Set(
      (await db.attemptAnswer.findMany({ where: { attemptId, checkedAt: { not: null } }, select: { questionId: true } })).map(
        (item) => item.questionId,
      ),
    );

    // One upsert per question with everything the payload carries for it.
    const questionIds = new Set<string>([...Object.keys(answerMap), ...Object.keys(timeMap), ...reviewMeta.keys()]);
    for (const questionId of questionIds) {
      if (!allowedQuestionIds.has(questionId)) continue;
      const answer = answerMap[questionId];
      const data = {
        ...(typeof answer === "string" && !lockedQuestionIds.has(questionId) ? { answer } : {}),
        ...(questionId in timeMap ? { timeSpent: Math.max(0, Number(timeMap[questionId]) || 0) } : {}),
        ...(reviewMeta.get(questionId) ?? {}),
      };
      if (Object.keys(data).length === 0) continue;
      await db.attemptAnswer.upsert({
        where: { attemptId_questionId: { attemptId, questionId } },
        update: data,
        create: { attemptId, questionId, ...data },
      });
    }

    // markedQuestionIds is the full marked set: unmark stored rows that are no longer in it.
    if (markedIds) {
      await db.attemptAnswer.updateMany({
        where: { attemptId, markedForReview: true, questionId: { notIn: [...markedIds] } },
        data: { markedForReview: false },
      });
    }
    return true;
  });
  if (!open) return new NotFoundError("Not found").toResponse();
  await markUserActive(session.user.id);

  return NextResponse.json({ ok: true });
});
