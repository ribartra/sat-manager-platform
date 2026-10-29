import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApprovedSession } from "@/lib/rbac";
import { fullTestModulesForAttempt } from "@/lib/full-test-snapshot";
import { completedModulesOf } from "@/lib/full-test-progress";
import { formatCorrectAnswer, isAnswerCorrect } from "@/lib/answer-grading";
import { resolveQuestionType } from "@/lib/question-type";
import { BadRequestError, ForbiddenError, NotFoundError, UnauthorizedError, withApiErrors } from "@/lib/api-error";

// Test player "Check" (only when the assignment gave "Show explanations in the player"): grades one
// answer of a module still open, locks it, and returns the key and explanation for that question.
//   POST /api/full-practice-tests/attempts/[attemptId]/check  { questionId, answer }
export const POST = withApiErrors(async function POST(req: NextRequest, { params }: { params: Promise<{ attemptId: string }> }) {
  const session = await requireApprovedSession();
  if (!session) return new UnauthorizedError("Please sign in again.").toResponse();

  const { attemptId } = await params;
  const body = (await req.json().catch(() => ({}))) as { questionId?: unknown; answer?: unknown };
  const questionId = typeof body.questionId === "string" ? body.questionId : "";
  const answer = typeof body.answer === "string" ? body.answer.trim() : "";
  if (!questionId || !answer) return new BadRequestError("Answer the question first.").toResponse();

  const attempt = await prisma.fullPracticeTestAttempt.findFirst({
    where: { id: attemptId, studentId: session.user.id, status: "IN_PROGRESS" },
    select: { id: true, testId: true, testSnapshot: true, moduleTimerState: true, showExplanations: true, assignment: { select: { showExplanations: true } } },
  });
  if (!attempt) return new NotFoundError("This test was already submitted or closed by your teacher.").toResponse();
  if (!(attempt.showExplanations ?? attempt.assignment?.showExplanations ?? false)) {
    return new ForbiddenError("Explanations are turned off for this test.").toResponse();
  }

  // The question must be in a module the student has not submitted yet (graded from the snapshot).
  const modules = await fullTestModulesForAttempt(attempt);
  const completed = new Set(completedModulesOf(attempt.moduleTimerState, modules.length));
  const moduleIndex = modules.findIndex((m) => m.questions.some((q) => q.questionId === questionId));
  if (moduleIndex < 0) return new NotFoundError("We couldn't find this question in the test.").toResponse();
  if (completed.has(moduleIndex)) return new BadRequestError("This module was already submitted.").toResponse();
  const item = modules[moduleIndex].questions.find((q) => q.questionId === questionId)!;

  const existing = await prisma.fullPracticeTestAnswer.findUnique({
    where: { attemptId_questionId: { attemptId, questionId } },
    select: { answer: true, checkedAt: true },
  });
  // Already checked: return the stored result; the answer cannot change any more.
  const finalAnswer = existing?.checkedAt && existing.answer ? existing.answer : answer;
  const question = item.question;
  const isCorrect = isAnswerCorrect(finalAnswer, question.correctAnswer, resolveQuestionType(question.type, question.options));
  if (!existing?.checkedAt) {
    await prisma.fullPracticeTestAnswer.upsert({
      where: { attemptId_questionId: { attemptId, questionId } },
      update: { answer: finalAnswer, isCorrect, checkedAt: new Date() },
      create: { attemptId, questionId, moduleId: modules[moduleIndex].id, answer: finalAnswer, isCorrect, checkedAt: new Date() },
    });
  }
  return NextResponse.json({
    answer: finalAnswer,
    isCorrect,
    answerKey: question.correctAnswer,
    correctAnswer: formatCorrectAnswer(question.correctAnswer),
    explanation: question.explanation ?? null,
  });
});
