import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { notifyTeachers } from "@/lib/notifications";
import { requireApprovedSession } from "@/lib/rbac";
import { markUserActive } from "@/lib/activity";
import { scaledScore } from "@/lib/full-test-scoring";
import { isAnswerCorrect } from "@/lib/answer-grading";

interface RouteContext {
  params: Promise<{ attemptId: string }>;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await requireApprovedSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { attemptId } = await params;
  const { answers, timeSpentByQuestion, timeExpiredEvents, extraTimeUsed } = await req.json();
  const attempt = await prisma.fullPracticeTestAttempt.findFirst({
    where: { id: attemptId, studentId: session.user.id, status: "IN_PROGRESS" },
  });
  if (!attempt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const modules = await prisma.fullPracticeTestModule.findMany({
    where: { testId: attempt.testId },
    include: { questions: { include: { question: true }, orderBy: { order: "asc" } } },
    orderBy: { order: "asc" },
  });

  let rwCorrect = 0;
  let rwTotal = 0;
  let mathCorrect = 0;
  let mathTotal = 0;
  for (const testModule of modules) {
    for (const item of testModule.questions) {
      const answer = (answers?.[item.questionId] ?? "") as string;
      const isCorrect = isAnswerCorrect(answer, item.question.correctAnswer, item.question.type);
      // Grade every item for review, but only operative (non-pretest) count toward raw/scaled.
      if (!item.isPretest) {
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
        },
        create: {
          attemptId,
          moduleId: testModule.id,
          questionId: item.questionId,
          answer: answer || null,
          isCorrect,
          timeSpent: timeSpentByQuestion?.[item.questionId] ?? undefined,
        },
      });
    }
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

  return NextResponse.json({
    ok: true,
    raw: { rwCorrect, rwTotal, mathCorrect, mathTotal },
    scores: { rwScore, mathScore, totalScore: rwScore + mathScore },
  });
}
