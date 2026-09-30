import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApprovedSession } from "@/lib/rbac";
import { withSqliteRetry } from "@/lib/sqlite-retry";
import { gradeCheck } from "@/lib/immediate-check";
import { BadRequestError, ForbiddenError, NotFoundError, UnauthorizedError, withApiErrors } from "@/lib/api-error";

// Immediate feedback "Check" (RNF-11): grades one answer on the server and locks it. The answer
// key and explanation are only returned here, for the question just checked.
//   POST /api/attempts/[attemptId]/check  { questionId, answer }
export const POST = withApiErrors(async function POST(req: NextRequest, { params }: { params: Promise<{ attemptId: string }> }) {
  const session = await requireApprovedSession();
  if (!session) return new UnauthorizedError("Unauthorized").toResponse();

  const { attemptId } = await params;
  const body = (await req.json().catch(() => ({}))) as { questionId?: unknown; answer?: unknown };
  const questionId = typeof body.questionId === "string" ? body.questionId : "";
  const answer = typeof body.answer === "string" ? body.answer.trim() : "";
  if (!questionId || !answer) return new BadRequestError("Answer the question first.").toResponse();

  const attempt = await withSqliteRetry(() => prisma.attempt.findFirst({
    where: { id: attemptId, studentId: session.user.id, status: "IN_PROGRESS" },
    select: { id: true, practiceSetId: true, assignment: { select: { feedbackMode: true } } },
  }));
  if (!attempt) return new NotFoundError("Not found").toResponse();
  if (attempt.assignment?.feedbackMode !== "IMMEDIATE") {
    return new ForbiddenError("Immediate feedback is not enabled for this assignment.").toResponse();
  }

  const item = await withSqliteRetry(() => prisma.practiceSetQuestion.findFirst({
    where: { practiceSetId: attempt.practiceSetId, questionId },
    select: {
      question: {
        select: { type: true, correctAnswer: true, explanation: true, options: { select: { label: true, text: true } } },
      },
    },
  }));
  if (!item) return new NotFoundError("Not found").toResponse();

  const existing = await withSqliteRetry(() => prisma.attemptAnswer.findUnique({
    where: { attemptId_questionId: { attemptId, questionId } },
    select: { answer: true, checkedAt: true, questionSnapshot: true },
  }));
  // Already checked: return the stored result; the answer cannot change any more.
  const finalAnswer = existing?.checkedAt && existing.answer ? existing.answer : answer;
  const result = gradeCheck(finalAnswer, item.question, existing?.questionSnapshot);

  if (!existing?.checkedAt) {
    await withSqliteRetry(() => prisma.attemptAnswer.upsert({
      where: { attemptId_questionId: { attemptId, questionId } },
      update: { answer: finalAnswer, isCorrect: result.isCorrect, checkedAt: new Date() },
      create: { attemptId, questionId, answer: finalAnswer, isCorrect: result.isCorrect, checkedAt: new Date() },
    }));
  }

  return NextResponse.json({ answer: finalAnswer, ...result });
});
