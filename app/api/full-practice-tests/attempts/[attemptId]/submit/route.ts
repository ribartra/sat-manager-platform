import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { notifyTeachers } from "@/lib/notifications";
import { requireApprovedSession } from "@/lib/rbac";
import { markUserActive } from "@/lib/activity";
import { scaledScore } from "@/lib/full-test-scoring";
import { isAnswerCorrect } from "@/lib/answer-grading";
import { writeAudit } from "@/lib/audit";
import { getFeatureSetting } from "@/lib/app-settings";
import { resolveQuestionType } from "@/lib/question-type";
import { reviewMetaByQuestion } from "@/lib/answer-review-meta";
import { NotFoundError, UnauthorizedError, withApiErrors } from "@/lib/api-error";

interface RouteContext {
  params: Promise<{ attemptId: string }>;
}

export const POST = withApiErrors(async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await requireApprovedSession();
  if (!session) return new UnauthorizedError("Unauthorized").toResponse();

  const { attemptId } = await params;
  const body = await req.json();
  const { answers, timeSpentByQuestion, timeExpiredEvents, extraTimeUsed } = body;
  const attempt = await prisma.fullPracticeTestAttempt.findFirst({
    where: { id: attemptId, studentId: session.user.id, status: "IN_PROGRESS" },
  });
  if (!attempt) return new NotFoundError("Not found").toResponse();

  const excludePretest = await getFeatureSetting("FPT_PRETEST_EXCLUSION");

  const modules = await prisma.fullPracticeTestModule.findMany({
    where: { testId: attempt.testId },
    include: {
      questions: {
        include: { question: { include: { options: true } } },
        orderBy: { order: "asc" },
      },
    },
    orderBy: { order: "asc" },
  });

  const allowedIds = new Set(modules.flatMap((testModule) => testModule.questions.map((item) => item.questionId)));
  const { byQuestion: reviewMeta, markedIds } = reviewMetaByQuestion(body, allowedIds);

  let rwCorrect = 0;
  let rwTotal = 0;
  let mathCorrect = 0;
  let mathTotal = 0;
  for (const testModule of modules) {
    for (const item of testModule.questions) {
      const answer = (answers?.[item.questionId] ?? "") as string;
      const isCorrect = isAnswerCorrect(
        answer,
        item.question.correctAnswer,
        resolveQuestionType(item.question.type, item.question.options),
      );
      const countsTowardScore = !excludePretest || !item.isPretest;
      if (countsTowardScore) {
        if (testModule.section === "MATH") {
          mathTotal += 1;
          if (isCorrect) mathCorrect += 1;
        } else {
          rwTotal += 1;
          if (isCorrect) rwCorrect += 1;
        }
      }
      await prisma.fullPracticeTestAnswer.upsert({
        where: { attemptId_questionId: { attemptId, questionId: item.questionId } },
        update: {
          moduleId: testModule.id,
          answer: answer || null,
          isCorrect,
          timeSpent: timeSpentByQuestion?.[item.questionId] ?? undefined,
          ...(reviewMeta.get(item.questionId) ?? {}),
        },
        create: {
          attemptId,
          moduleId: testModule.id,
          questionId: item.questionId,
          answer: answer || null,
          isCorrect,
          timeSpent: timeSpentByQuestion?.[item.questionId] ?? undefined,
          ...(reviewMeta.get(item.questionId) ?? {}),
        },
      });
    }
  }

  if (markedIds) {
    await prisma.fullPracticeTestAnswer.updateMany({
      where: { attemptId, markedForReview: true, questionId: { notIn: [...markedIds] } },
      data: { markedForReview: false },
    });
  }

  const rwScore = await scaledScore("RW", rwCorrect, rwTotal);
  const mathScore = await scaledScore("MATH", mathCorrect, mathTotal);
  const submittedAt = new Date();
  await Promise.all([
    prisma.fullPracticeTestAttempt.update({
      where: { id: attemptId },
      data: {
        status: "SUBMITTED",
        submittedAt,
        rwScore,
        mathScore,
        totalScore: rwScore + mathScore,
        timeExpiredEvents: timeExpiredEvents ?? 0,
        extraTimeUsed: extraTimeUsed ?? 0,
      },
    }),
    markUserActive(session.user.id, submittedAt),
  ]);
  if (attempt.assignmentId) {
    await prisma.fullPracticeTestAssignment.update({
      where: { id: attempt.assignmentId },
      data: { status: "COMPLETED" },
    });
  }
  await notifyTeachers(
    "Exam completed",
    `${session.user.name} completed an Exam.`,
    `/student/full-tests/results/${attemptId}`,
  );

  await writeAudit({
    userId: session.user.id,
    action: "FPT_ATTEMPT_SUBMITTED",
    targetType: "FullPracticeTestAttempt",
    targetId: attemptId,
    outcome: "success",
    metadata: {
      testId: attempt.testId,
      scores: { rwScore, mathScore, totalScore: rwScore + mathScore },
    },
  });

  return NextResponse.json({
    ok: true,
    raw: { rwCorrect, rwTotal, mathCorrect, mathTotal },
    scores: { rwScore, mathScore, totalScore: rwScore + mathScore },
  });
});
