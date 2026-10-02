import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApprovedSession } from "@/lib/rbac";
import { markUserActive } from "@/lib/activity";
import { saveFullTestTimerState } from "@/lib/full-test-progress";
import { reviewMetaByQuestion } from "@/lib/answer-review-meta";
import { fullTestModulesForAttempt } from "@/lib/full-test-snapshot";
import { NotFoundError, UnauthorizedError, withApiErrors } from "@/lib/api-error";

interface RouteContext {
  params: Promise<{ attemptId: string }>;
}

export const POST = withApiErrors(async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await requireApprovedSession();
  if (!session) return new UnauthorizedError("Unauthorized").toResponse();

  const { attemptId } = await params;
  const body = await req.json();
  const { answers, currentModule, currentQuestion, timeExpiredEvents, extraTimeUsed, moduleTimerState, timeSpentByQuestion } = body;
  const attempt = await prisma.fullPracticeTestAttempt.findFirst({
    where: { id: attemptId, studentId: session.user.id, status: "IN_PROGRESS" },
  });
  if (!attempt) return new NotFoundError("Not found").toResponse();

  await Promise.all([
    prisma.fullPracticeTestAttempt.update({
      where: { id: attemptId },
      data: {
        currentModule: Number.isInteger(currentModule) ? currentModule : attempt.currentModule,
        currentQuestion: Number.isInteger(currentQuestion) ? currentQuestion : attempt.currentQuestion,
        timeExpiredEvents: Number.isInteger(timeExpiredEvents) ? timeExpiredEvents : attempt.timeExpiredEvents,
        extraTimeUsed: Number.isInteger(extraTimeUsed) ? extraTimeUsed : attempt.extraTimeUsed,
      },
    }),
    markUserActive(session.user.id),
    saveFullTestTimerState(attemptId, moduleTimerState),
  ]);

  // Question → module map of the exam as this attempt started it (RNF-17 snapshot).
  const modules = await fullTestModulesForAttempt(attempt);
  const moduleByQuestionId = new Map<string, string>();
  for (const testModule of modules) {
    for (const item of testModule.questions) moduleByQuestionId.set(item.questionId, testModule.id);
  }
  const allowedIds = new Set(moduleByQuestionId.keys());
  const answerMap = answers && typeof answers === "object" ? (answers as Record<string, string>) : {};
  const timeMap = timeSpentByQuestion && typeof timeSpentByQuestion === "object" ? (timeSpentByQuestion as Record<string, number>) : {};
  const { byQuestion: reviewMeta, markedIds } = reviewMetaByQuestion(body, allowedIds);

  // One upsert per question with everything the payload carries for it.
  const questionIds = new Set<string>([...Object.keys(answerMap), ...Object.keys(timeMap), ...reviewMeta.keys()]);
  await Promise.all(
    [...questionIds].map((questionId) => {
      const moduleId = moduleByQuestionId.get(questionId);
      if (!moduleId) return Promise.resolve();
      const data = {
        moduleId,
        ...(questionId in answerMap ? { answer: answerMap[questionId] || null } : {}),
        ...(questionId in timeMap ? { timeSpent: Number(timeMap[questionId]) || 0 } : {}),
        ...(reviewMeta.get(questionId) ?? {}),
      };
      return prisma.fullPracticeTestAnswer.upsert({
        where: { attemptId_questionId: { attemptId, questionId } },
        update: data,
        create: { attemptId, questionId, ...data },
      });
    }),
  );
  if (markedIds) {
    await prisma.fullPracticeTestAnswer.updateMany({
      where: { attemptId, markedForReview: true, questionId: { notIn: [...markedIds] } },
      data: { markedForReview: false },
    });
  }

  return NextResponse.json({ ok: true });
});
