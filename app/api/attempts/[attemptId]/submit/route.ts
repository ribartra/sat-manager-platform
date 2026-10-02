import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { notifyTeachers } from "@/lib/notifications";
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
  if (!session) return new UnauthorizedError("Unauthorized").toResponse();

  const { attemptId } = await params;
  const { answers: submittedAnswers, totalTime, timeSpentByQuestion, markedQuestionIds, notes, eliminatedOptions } = await req.json();

  const attempt = await prisma.attempt.findFirst({
    where: { id: attemptId, studentId: session.user.id, status: "IN_PROGRESS" },
    include: {
      answers: true,
    },
  });
  if (!attempt) return new NotFoundError("Not found").toResponse();

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

  // Score each answer
  await Promise.all(
    Object.entries(answers as Record<string, string>).filter(([questionId]) => allowedQuestionIds.has(questionId)).map(([questionId, answer]) => {
      const snapshot = questionSnapshotMap.get(questionId);
      const storedQuestion = questionById.get(questionId);
      const isCorrect = isAnswerCorrect(
        answer,
        snapshot?.correctAnswer,
        resolveQuestionType(snapshot?.type ?? storedQuestion?.type ?? "MC", snapshot?.options?.length ? snapshot.options : storedQuestion?.options),
      );
      if (isCorrect) correctCount += 1;
      const existing = existingAnswers.get(questionId);
      return prisma.attemptAnswer.upsert({
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
    })
  );

  // Mark unanswered questions
  await Promise.all(
    psQuestions
      .filter((item) => !answers[item.questionId])
      .map((item) =>
        {
          const snapshot = questionSnapshotMap.get(item.questionId);
          const existing = existingAnswers.get(item.questionId);
          return prisma.attemptAnswer.upsert({
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
        }
      )
  );

  const submittedAt = new Date();
  const sectionMeta = psQuestions[0]?.practiceSet.topic.domain.section ?? null;
  const scored = await scorePracticeSetAttempt({
    correct: correctCount,
    total: psQuestions.length,
    section: sectionMeta,
  });

  await Promise.all([
    prisma.attempt.update({
      where: { id: attemptId },
      data: {
        status: "SUBMITTED",
        submittedAt,
        totalTime,
        practiceSetSnapshot,
        scorePercent: scored.scorePercent,
        scaledScore: scored.scaledScore,
        scoreSection: scored.scoreSection,
      },
    }),
    markUserActive(session.user.id, submittedAt),
  ]);

  // Update assignment status
  if (attempt.assignmentId) {
    await prisma.assignment.update({
      where: { id: attempt.assignmentId },
      data: { status: "COMPLETED" },
    });
  }

  const practiceSet = await prisma.practiceSet.findUnique({ where: { id: attempt.practiceSetId }, select: { name: true } });
  await notifyTeachers("Practice completed", `${session.user.name} completed ${practiceSet?.name ?? "a practice set"}.`, `/teacher/students/${session.user.id}/attempts/${attemptId}`);
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
