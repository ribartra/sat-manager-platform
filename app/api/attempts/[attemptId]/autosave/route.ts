import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApprovedSession } from "@/lib/rbac";

export async function POST(req: NextRequest, { params }: { params: Promise<{ attemptId: string }> }) {
  const session = await requireApprovedSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { attemptId } = await params;
  const { answers, currentQuestion, totalTime, timeSpentByQuestion, markedQuestionIds, notes, eliminatedOptions } = await req.json();

  const attempt = await prisma.attempt.findFirst({
    where: { id: attemptId, studentId: session.user.id, status: "IN_PROGRESS" },
  });
  if (!attempt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.attempt.update({
    where: { id: attemptId },
    data: { currentQuestion, totalTime },
  });

  // Upsert each answer
  if (answers && typeof answers === "object") {
    await Promise.all(
      Object.entries(answers).map(([questionId, answer]) =>
        prisma.attemptAnswer.upsert({
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
        })
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
      Array.from(metadataQuestionIds).map((questionId) =>
        prisma.attemptAnswer.upsert({
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
        })
      )
    );
  }

  if (timeSpentByQuestion && typeof timeSpentByQuestion === "object") {
    await Promise.all(
      Object.entries(timeSpentByQuestion).map(([questionId, timeSpent]) =>
        prisma.attemptAnswer.upsert({
          where: { attemptId_questionId: { attemptId, questionId } },
          update: { timeSpent: Number(timeSpent) || 0 },
          create: { attemptId, questionId, timeSpent: Number(timeSpent) || 0 },
        })
      )
    );
  }

  return NextResponse.json({ ok: true });
}
