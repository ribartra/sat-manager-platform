import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApprovedSession } from "@/lib/rbac";
import { markUserActive } from "@/lib/activity";
import { saveFullTestTimerState } from "@/lib/full-test-progress";

interface RouteContext {
  params: Promise<{ attemptId: string }>;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await requireApprovedSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { attemptId } = await params;
  const { answers, currentModule, currentQuestion, timeExpiredEvents, extraTimeUsed, moduleTimerState, timeSpentByQuestion } = await req.json();
  const attempt = await prisma.fullPracticeTestAttempt.findFirst({
    where: { id: attemptId, studentId: session.user.id, status: "IN_PROGRESS" },
  });
  if (!attempt) return NextResponse.json({ error: "Not found" }, { status: 404 });

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

  if (answers && typeof answers === "object") {
    const modules = await prisma.fullPracticeTestModule.findMany({
      where: { testId: attempt.testId },
      include: { questions: true },
    });
    const moduleByQuestionId = new Map<string, string>();
    for (const testModule of modules) {
      for (const item of testModule.questions) moduleByQuestionId.set(item.questionId, testModule.id);
    }

    await Promise.all(
      Object.entries(answers as Record<string, string>).map(([questionId, answer]) => {
        const moduleId = moduleByQuestionId.get(questionId);
        if (!moduleId) return Promise.resolve();
        return prisma.fullPracticeTestAnswer.upsert({
          where: { attemptId_questionId: { attemptId, questionId } },
          update: { moduleId, answer: answer || null, timeSpent: timeSpentByQuestion?.[questionId] ?? undefined },
          create: { attemptId, moduleId, questionId, answer: answer || null, timeSpent: timeSpentByQuestion?.[questionId] ?? undefined },
        });
      })
    );
  }

  if (timeSpentByQuestion && typeof timeSpentByQuestion === "object") {
    const modules = await prisma.fullPracticeTestModule.findMany({
      where: { testId: attempt.testId },
      include: { questions: true },
    });
    const moduleByQuestionId = new Map<string, string>();
    for (const testModule of modules) {
      for (const item of testModule.questions) moduleByQuestionId.set(item.questionId, testModule.id);
    }
    await Promise.all(
      Object.entries(timeSpentByQuestion as Record<string, number>).map(([questionId, timeSpent]) => {
        const moduleId = moduleByQuestionId.get(questionId);
        if (!moduleId) return Promise.resolve();
        return prisma.fullPracticeTestAnswer.upsert({
          where: { attemptId_questionId: { attemptId, questionId } },
          update: { moduleId, timeSpent: Number(timeSpent) || 0 },
          create: { attemptId, moduleId, questionId, timeSpent: Number(timeSpent) || 0 },
        });
      })
    );
  }

  return NextResponse.json({ ok: true });
}
