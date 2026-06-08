import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notifyTeachers } from "@/lib/notifications";

export async function POST(req: NextRequest, { params }: { params: Promise<{ attemptId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { attemptId } = await params;
  const { answers, totalTime, timeSpentByQuestion, markedQuestionIds, notes, eliminatedOptions } = await req.json();

  const attempt = await prisma.attempt.findFirst({
    where: { id: attemptId, studentId: session.user.id },
    include: {
      answers: true,
    },
  });
  if (!attempt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Get the practice set questions to check correct answers
  const psQuestions = await prisma.practiceSetQuestion.findMany({
    where: { practiceSetId: attempt.practiceSetId },
    include: { question: true },
  });

  const correctAnswerMap: Record<string, string> = {};
  psQuestions.forEach((item) => {
    correctAnswerMap[item.questionId] = item.question.correctAnswer;
  });

  // Score each answer
  await Promise.all(
    Object.entries(answers as Record<string, string>).map(([questionId, answer]) => {
      const correct = correctAnswerMap[questionId];
      const isCorrect = correct !== undefined && answer.trim().toUpperCase() === correct.trim().toUpperCase();
      return prisma.attemptAnswer.upsert({
        where: { attemptId_questionId: { attemptId, questionId } },
        update: {
          answer,
          isCorrect,
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
          answer,
          isCorrect,
          timeSpent: timeSpentByQuestion?.[questionId] ?? undefined,
          markedForReview: Array.isArray(markedQuestionIds) ? markedQuestionIds.includes(questionId) : false,
          note: typeof notes?.[questionId] === "string" ? notes[questionId] : undefined,
          eliminatedOptions: Array.isArray(eliminatedOptions?.[questionId])
            ? JSON.stringify(eliminatedOptions[questionId])
            : undefined,
        },
      });
    })
  );

  // Mark unanswered questions
  await Promise.all(
    psQuestions
      .filter((item) => !answers[item.questionId])
      .map((item) =>
        prisma.attemptAnswer.upsert({
          where: { attemptId_questionId: { attemptId, questionId: item.questionId } },
          update: {
            answer: null,
            isCorrect: false,
            timeSpent: timeSpentByQuestion?.[item.questionId] ?? undefined,
            markedForReview: Array.isArray(markedQuestionIds) ? markedQuestionIds.includes(item.questionId) : undefined,
            note: typeof notes?.[item.questionId] === "string" ? notes[item.questionId] : undefined,
            eliminatedOptions: Array.isArray(eliminatedOptions?.[item.questionId])
              ? JSON.stringify(eliminatedOptions[item.questionId])
              : undefined,
          },
          create: {
            attemptId,
            questionId: item.questionId,
            answer: null,
            isCorrect: false,
            timeSpent: timeSpentByQuestion?.[item.questionId] ?? undefined,
            markedForReview: Array.isArray(markedQuestionIds) ? markedQuestionIds.includes(item.questionId) : false,
            note: typeof notes?.[item.questionId] === "string" ? notes[item.questionId] : undefined,
            eliminatedOptions: Array.isArray(eliminatedOptions?.[item.questionId])
              ? JSON.stringify(eliminatedOptions[item.questionId])
              : undefined,
          },
        })
      )
  );

  await prisma.attempt.update({
    where: { id: attemptId },
    data: { status: "SUBMITTED", submittedAt: new Date(), totalTime },
  });

  // Update assignment status
  if (attempt.assignmentId) {
    await prisma.assignment.update({
      where: { id: attempt.assignmentId },
      data: { status: "COMPLETED" },
    });
  }

  const practiceSet = await prisma.practiceSet.findUnique({ where: { id: attempt.practiceSetId }, select: { name: true } });
  await notifyTeachers("Practice completed", `${session.user.name} completed ${practiceSet?.name ?? "a practice set"}.`, `/teacher/students/${session.user.id}/attempts/${attemptId}`);

  return NextResponse.json({ ok: true });
}
