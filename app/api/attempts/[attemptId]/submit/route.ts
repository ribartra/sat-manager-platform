import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { notifyStudentTeachers } from "@/lib/notifications";
import { requireApprovedSession } from "@/lib/rbac";
import {
  buildPracticeSetSnapshot,
  buildQuestionSnapshot,
  parseSnapshot,
  QuestionSnapshot,
  stringifySnapshot,
} from "@/lib/attempt-snapshots";
import { applyPracticeProgression } from "@/lib/practice-progression";
import { markUserActive } from "@/lib/activity";
import { isAnswerCorrect } from "@/lib/answer-grading";
import { resolveQuestionType } from "@/lib/question-type";
import { scorePracticeSetAttempt } from "@/lib/practice-set-scoring";
import { writeAudit } from "@/lib/audit";
import { log, REQUEST_ID_HEADER } from "@/lib/observability";
import { NotFoundError, UnauthorizedError, withApiErrors } from "@/lib/api-error";

export const POST = withApiErrors(async function POST(req: NextRequest, { params }: { params: Promise<{ attemptId: string }> }) {
  const session = await requireApprovedSession();
  if (!session) return new UnauthorizedError("Please sign in again.").toResponse();

  const { attemptId } = await params;
  const { answers: submittedAnswers, totalTime, timeSpentByQuestion, markedQuestionIds, notes, eliminatedOptions } = await req.json();

  const attempt = await prisma.attempt.findFirst({
    where: { id: attemptId, studentId: session.user.id },
    include: {
      answers: true,
    },
  });
  // Idempotent: a repeated submit (two tabs, a retried request) gets the same answer as the first.
  if (attempt?.status === "SUBMITTED") return NextResponse.json({ ok: true, alreadySubmitted: true });
  if (!attempt || attempt.status !== "IN_PROGRESS") return new NotFoundError("This practice set was already submitted or closed by your teacher.").toResponse();

  // Get the practice set questions to check correct answers
  const psQuestions = await prisma.practiceSetQuestion.findMany({
    where: { practiceSetId: attempt.practiceSetId },
    include: {
      practiceSet: { include: { topic: { include: { domain: { include: { section: true } } } } } },
      question: {
        include: {
          options: { orderBy: { label: "asc" } },
          topic: { include: { domain: { include: { section: true } } } },
        },
      },
    },
    orderBy: { order: "asc" },
  });

  const existingAnswers = new Map(attempt.answers.map((answer) => [answer.questionId, answer]));
  // Answers already checked with immediate feedback are locked: the stored answer wins.
  const answers: Record<string, string> = { ...((submittedAnswers ?? {}) as Record<string, string>) };
  for (const answer of attempt.answers) {
    if (answer.checkedAt && answer.answer) answers[answer.questionId] = answer.answer;
  }
  const allowedQuestionIds = new Set(psQuestions.map((item) => item.questionId));
  const questionById = new Map(psQuestions.map((item) => [item.questionId, item.question]));
  const questionSnapshotMap = new Map(
    psQuestions.map((item) => {
      const existing = existingAnswers.get(item.questionId);
      const snapshot =
        parseSnapshot<QuestionSnapshot>(existing?.questionSnapshot) ??
        buildQuestionSnapshot(item);
      return [item.questionId, snapshot] as const;
    })
  );
  const practiceSetForSnapshot = psQuestions[0]?.practiceSet;
  const practiceSetSnapshot =
    attempt.practiceSetSnapshot ??
    (practiceSetForSnapshot
      ? stringifySnapshot(
          buildPracticeSetSnapshot({
            ...practiceSetForSnapshot,
            questions: psQuestions.map((item) => ({ questionId: item.questionId, order: item.order })),
          })
        )
      : undefined);

  let correctCount = 0;

  // Grade every answer first; the writes go in one transaction with the status change (below).
  const answerWrites: Parameters<typeof prisma.attemptAnswer.upsert>[0][] = [];
  // Score each answer
    Object.entries(answers as Record<string, string>).filter(([questionId]) => allowedQuestionIds.has(questionId)).forEach(([questionId, answer]) => {
      const snapshot = questionSnapshotMap.get(questionId);
      const storedQuestion = questionById.get(questionId);
      const isCorrect = isAnswerCorrect(
        answer,
        snapshot?.correctAnswer,
        resolveQuestionType(snapshot?.type ?? storedQuestion?.type ?? "MC", snapshot?.options?.length ? snapshot.options : storedQuestion?.options),
      );
      if (isCorrect) correctCount += 1;
      const existing = existingAnswers.get(questionId);
      answerWrites.push({
        where: { attemptId_questionId: { attemptId, questionId } },
        update: {
          questionSnapshot: existing?.questionSnapshot ?? (snapshot ? stringifySnapshot(snapshot) : undefined),
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
          questionSnapshot: snapshot ? stringifySnapshot(snapshot) : undefined,
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
    });

  // Mark unanswered questions
    psQuestions
      .filter((item) => !answers[item.questionId])
      .forEach((item) =>
        {
          const snapshot = questionSnapshotMap.get(item.questionId);
          const existing = existingAnswers.get(item.questionId);
          answerWrites.push({
            where: { attemptId_questionId: { attemptId, questionId: item.questionId } },
            update: {
              questionSnapshot: existing?.questionSnapshot ?? (snapshot ? stringifySnapshot(snapshot) : undefined),
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
              questionSnapshot: snapshot ? stringifySnapshot(snapshot) : undefined,
              answer: null,
              isCorrect: false,
              timeSpent: timeSpentByQuestion?.[item.questionId] ?? undefined,
              markedForReview: Array.isArray(markedQuestionIds) ? markedQuestionIds.includes(item.questionId) : false,
              note: typeof notes?.[item.questionId] === "string" ? notes[item.questionId] : undefined,
              eliminatedOptions: Array.isArray(eliminatedOptions?.[item.questionId])
                ? JSON.stringify(eliminatedOptions[item.questionId])
                : undefined,
            },
          });
        },
      );

  const submittedAt = new Date();
  const sectionMeta = psQuestions[0]?.practiceSet.topic.domain.section ?? null;
  const scored = await scorePracticeSetAttempt({
    correct: correctCount,
    total: psQuestions.length,
    section: sectionMeta,
  });

  // One transaction: every graded answer + the IN_PROGRESS → SUBMITTED transition + the assignment.
  // Only the request that makes the transition notifies, unlocks the next set and audits; a second
  // submit or a teacher's Invalidate in between leaves the attempt as it is.
  const transitioned = await prisma
    .$transaction(async (tx) => {
      for (const write of answerWrites) await tx.attemptAnswer.upsert(write);
      const { count } = await tx.attempt.updateMany({
        where: { id: attemptId, status: "IN_PROGRESS" },
        data: {
          status: "SUBMITTED",
          submittedAt,
          totalTime,
          practiceSetSnapshot,
          scorePercent: scored.scorePercent,
          scaledScore: scored.scaledScore,
          scoreSection: scored.scoreSection,
        },
      });
      if (count === 0) throw new AttemptAlreadyClosed();
      if (attempt.assignmentId) {
        // Only an open assignment becomes COMPLETED.
        await tx.assignment.updateMany({
          where: { id: attempt.assignmentId, status: { in: ["PENDING", "IN_PROGRESS", "OVERDUE"] } },
          data: { status: "COMPLETED" },
        });
      }
      return true;
    })
    .catch((error) => {
      if (error instanceof AttemptAlreadyClosed) return false;
      throw error;
    });
  if (!transitioned) {
    const current = await prisma.attempt.findUnique({ where: { id: attemptId }, select: { status: true } });
    if (current?.status === "SUBMITTED") return NextResponse.json({ ok: true, alreadySubmitted: true });
    return new NotFoundError("This practice set was already submitted or closed by your teacher.").toResponse();
  }
  await markUserActive(session.user.id, submittedAt);

  const practiceSet = await prisma.practiceSet.findUnique({ where: { id: attempt.practiceSetId }, select: { name: true } });
  await notifyStudentTeachers(session.user.id, "Practice completed", `${session.user.name} completed ${practiceSet?.name ?? "a practice set"}.`, `/teacher/students/${session.user.id}/attempts/${attemptId}`);
  await applyPracticeProgression({
    studentId: session.user.id,
    practiceSetId: attempt.practiceSetId,
    scorePercent: scored.scorePercent,
  });

  await writeAudit({
    userId: session.user.id,
    action: "ATTEMPT_SUBMITTED",
    targetType: "Attempt",
    targetId: attemptId,
    outcome: "success",
    metadata: {
      practiceSetId: attempt.practiceSetId,
      scorePercent: scored.scorePercent,
      scaledScore: scored.scaledScore,
    },
  });
  log.info("attempt.submit", {
    kind: "practice",
    attemptId,
    userId: session.user.id,
    practiceSetId: attempt.practiceSetId,
    scorePercent: scored.scorePercent,
    requestId: req.headers.get(REQUEST_ID_HEADER) ?? undefined,
  });

  return NextResponse.json({ ok: true });
});

/** Thrown inside the grading transaction when the attempt is no longer IN_PROGRESS (rolls it back). */
class AttemptAlreadyClosed extends Error {}
