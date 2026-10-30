import { NextRequest, NextResponse } from "next/server";
import prisma, { atomic } from "@/lib/prisma";
import { requireApprovedSession } from "@/lib/rbac";
import { markUserActive } from "@/lib/activity";
import { withSqliteRetry } from "@/lib/sqlite-retry";
import { NotFoundError, UnauthorizedError, withApiErrors } from "@/lib/api-error";

export const POST = withApiErrors(async function POST(req: NextRequest, { params }: { params: Promise<{ attemptId: string }> }) {
  const session = await requireApprovedSession();
  if (!session) return new UnauthorizedError("Unauthorized").toResponse();

  const { attemptId } = await params;
  const { answers, currentQuestion, totalTime, timeSpentByQuestion, markedQuestionIds, notes, eliminatedOptions } = await req.json();

  const attempt = await withSqliteRetry(() => prisma.attempt.findFirst({
    where: { id: attemptId, studentId: session.user.id, status: "IN_PROGRESS" },
  }));
  if (!attempt) return new NotFoundError("Not found").toResponse();

  const allowedQuestions = await withSqliteRetry(() => prisma.practiceSetQuestion.findMany({
    where: { practiceSetId: attempt.practiceSetId },
    select: { questionId: true },
  }));
  const allowedQuestionIds = new Set(allowedQuestions.map((item) => item.questionId));
  // Answers checked with immediate feedback are locked on the server, not only in the UI.
  const lockedQuestionIds = new Set(
    (await withSqliteRetry(() => prisma.attemptAnswer.findMany({
      where: { attemptId, checkedAt: { not: null } },
      select: { questionId: true },
    }))).map((item) => item.questionId),
  );

  // All the writes in one transaction, with the status re-read inside it: a save that arrives late (the
  // debounce, the page-hide keepalive) after the set was submitted or closed writes nothing.
  const open = await atomic(async (db) => {
    const fresh = await db.attempt.findUnique({ where: { id: attemptId }, select: { status: true } });
    if (fresh?.status !== "IN_PROGRESS") return false;
    await withSqliteRetry(() => prisma.attempt.update({
      where: { id: attemptId },
      data: { currentQuestion, totalTime },
    }));

    // Upsert each answer
    if (answers && typeof answers === "object") {
      await Promise.all(
        Object.entries(answers)
          .filter(([questionId]) => allowedQuestionIds.has(questionId) && !lockedQuestionIds.has(questionId))
          .map(([questionId, answer]) =>
          withSqliteRetry(() => prisma.attemptAnswer.upsert({
            where: { attemptId_questionId: { attemptId, questionId } },
            update: {
              answer: answer as string,
              timeSpent: timeSpentByQuestion?.[questionId] ?? undefined,
              markedForReview: Array.isArray(markedQuestionIds) ? markedQuestionIds.includes(questionId) : undefined,
              note: typeof notes?.[questionId] === "string" ? notes[questionId] : undefined,
              eliminatedOptions: Array.isArray(eliminatedOptions?.[questionId])
                ? JSON.stringify(eliminatedOptions[questionId])
                : undefined,
            },
            create: {
              attemptId,
              questionId,
              answer: answer as string,
              timeSpent: timeSpentByQuestion?.[questionId] ?? undefined,
              markedForReview: Array.isArray(markedQuestionIds) ? markedQuestionIds.includes(questionId) : false,
              note: typeof notes?.[questionId] === "string" ? notes[questionId] : undefined,
              eliminatedOptions: Array.isArray(eliminatedOptions?.[questionId])
                ? JSON.stringify(eliminatedOptions[questionId])
                : undefined,
            },
          }))
        )
      );
    }

    const metadataQuestionIds = new Set<string>([
      ...(Array.isArray(markedQuestionIds) ? markedQuestionIds : []),
      ...Object.keys(notes ?? {}),
      ...Object.keys(eliminatedOptions ?? {}),
    ]);

    if (metadataQuestionIds.size > 0) {
      await Promise.all(
        Array.from(metadataQuestionIds)
          .filter((questionId) => allowedQuestionIds.has(questionId))
          .map((questionId) =>
            withSqliteRetry(() => prisma.attemptAnswer.upsert({
            where: { attemptId_questionId: { attemptId, questionId } },
            update: {
              markedForReview: Array.isArray(markedQuestionIds) ? markedQuestionIds.includes(questionId) : undefined,
              note: typeof notes?.[questionId] === "string" ? notes[questionId] : undefined,
              eliminatedOptions: Array.isArray(eliminatedOptions?.[questionId])
                ? JSON.stringify(eliminatedOptions[questionId])
                : undefined,
            },
            create: {
              attemptId,
              questionId,
              markedForReview: Array.isArray(markedQuestionIds) ? markedQuestionIds.includes(questionId) : false,
              note: typeof notes?.[questionId] === "string" ? notes[questionId] : undefined,
              eliminatedOptions: Array.isArray(eliminatedOptions?.[questionId])
                ? JSON.stringify(eliminatedOptions[questionId])
                : undefined,
            },
            }))
        )
      );
    }

    // markedQuestionIds is the full marked set: unmark stored rows that are no longer in it.
    if (Array.isArray(markedQuestionIds)) {
      await withSqliteRetry(() => prisma.attemptAnswer.updateMany({
        where: { attemptId, markedForReview: true, questionId: { notIn: markedQuestionIds.filter((id: unknown): id is string => typeof id === "string") } },
        data: { markedForReview: false },
      }));
    }

    if (timeSpentByQuestion && typeof timeSpentByQuestion === "object") {
      await Promise.all(
        Object.entries(timeSpentByQuestion)
          .filter(([questionId]) => allowedQuestionIds.has(questionId))
          .map(([questionId, timeSpent]) =>
          withSqliteRetry(() => prisma.attemptAnswer.upsert({
            where: { attemptId_questionId: { attemptId, questionId } },
            update: { timeSpent: Number(timeSpent) || 0 },
            create: { attemptId, questionId, timeSpent: Number(timeSpent) || 0 },
          }))
        )
      );
    }
    return true;
  });
  if (!open) return new NotFoundError("Not found").toResponse();
  await markUserActive(session.user.id);

  return NextResponse.json({ ok: true });
});
