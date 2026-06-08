import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { notifyTeachers } from "@/lib/notifications";
import { requireApprovedSession } from "@/lib/rbac";

interface RouteContext {
  params: Promise<{ attemptId: string }>;
}

async function scaledScore(section: "RW" | "MATH", correct: number, total: number) {
  const conversion = await prisma.fullPracticeTestScoreConversion.findUnique({
    where: { section_rawCorrect: { section, rawCorrect: correct } },
  });
  if (conversion) return conversion.score;
  if (!total) return 200;
  return Math.max(200, Math.min(800, Math.round(200 + (correct / total) * 600)));
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await requireApprovedSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { attemptId } = await params;
  const { answers, timeSpentByQuestion, timeExpiredEvents, extraTimeUsed } = await req.json();
  const attempt = await prisma.fullPracticeTestAttempt.findFirst({ where: { id: attemptId, studentId: session.user.id } });
  if (!attempt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const modules = await prisma.fullPracticeTestModule.findMany({
    where: { testId: attempt.testId },
    include: { questions: { include: { question: true } } },
  });

  let rwCorrect = 0, rwTotal = 0, mathCorrect = 0, mathTotal = 0;
  for (const testModule of modules) {
    for (const item of testModule.questions) {
      const answer = (answers?.[item.questionId] ?? "") as string;
      const isCorrect = Boolean(answer) && answer.trim().toUpperCase() === item.question.correctAnswer.trim().toUpperCase();
      if (testModule.section === "MATH") {
        mathTotal += 1;
        if (isCorrect) mathCorrect += 1;
      } else {
        rwTotal += 1;
        if (isCorrect) rwCorrect += 1;
      }
      await prisma.fullPracticeTestAnswer.upsert({
        where: { attemptId_questionId: { attemptId, questionId: item.questionId } },
        update: { moduleId: testModule.id, answer: answer || null, isCorrect, timeSpent: timeSpentByQuestion?.[item.questionId] ?? undefined },
        create: { attemptId, moduleId: testModule.id, questionId: item.questionId, answer: answer || null, isCorrect, timeSpent: timeSpentByQuestion?.[item.questionId] ?? undefined },
      });
    }
  }

  const rwScore = await scaledScore("RW", rwCorrect, rwTotal);
  const mathScore = await scaledScore("MATH", mathCorrect, mathTotal);
  await prisma.fullPracticeTestAttempt.update({
    where: { id: attemptId },
    data: { status: "SUBMITTED", submittedAt: new Date(), rwScore, mathScore, totalScore: rwScore + mathScore, timeExpiredEvents: timeExpiredEvents ?? 0, extraTimeUsed: extraTimeUsed ?? 0 },
  });
  if (attempt.assignmentId) await prisma.fullPracticeTestAssignment.update({ where: { id: attempt.assignmentId }, data: { status: "COMPLETED" } });
  await notifyTeachers("Full Practice Test completed", `${session.user.name} completed a full practice test.`, `/student/full-tests/results/${attemptId}`);

  return NextResponse.json({ ok: true });
}
