import prisma from "@/lib/prisma";
import { notifyStudentTeachers } from "@/lib/notifications";
import { NotFoundError } from "@/lib/api-error";
import { markUserActive } from "@/lib/activity";
import { scaledScore } from "@/lib/full-test-scoring";
import { isAnswerCorrect } from "@/lib/answer-grading";
import { writeAudit } from "@/lib/audit";
import { getFeatureSetting } from "@/lib/app-settings";
import { resolveQuestionType } from "@/lib/question-type";
import { reviewMetaByQuestion, type ReviewMetaInput } from "@/lib/answer-review-meta";
import { fullTestModulesForAttempt } from "@/lib/full-test-snapshot";
import { completedModulesOf, getFullTestProgressState, saveFullTestProgressState, saveFullTestTimerState } from "@/lib/full-test-progress";

/**
 * Test (Full Practice Test) attempt persistence and grading, shared by:
 *  - POST …/autosave (answers of submitted modules are locked),
 *  - POST …/modules/[index]/submit (students take modules in any order; grading runs when the 4th is in),
 *  - POST …/submit (whole-test submit, kept for older clients and previews).
 */

type AttemptRow = {
  id: string;
  testId: string;
  testSnapshot: string | null;
  assignmentId: string | null;
  extraTimeUsed: number;
  timeExpiredEvents: number;
  currentModule: number;
  currentQuestion: number;
  moduleTimerState: string | null;
};

export type FullTestSaveBody = ReviewMetaInput & {
  answers?: unknown;
  currentModule?: unknown;
  currentQuestion?: unknown;
  timeExpiredEvents?: unknown;
  extraTimeUsed?: unknown;
  moduleTimerState?: unknown;
  timeSpentByQuestion?: unknown;
};

async function attemptModules(attempt: AttemptRow) {
  // Grade/render the exam this attempt started with (RNF-17 snapshot), not the live exam.
  return fullTestModulesForAttempt(attempt);
}

/**
 * Autosave: position, timers and per-question answers/times/review tools. Questions of modules the
 * student already submitted are ignored (a submitted module cannot be changed).
 */
export async function saveFullTestProgress(attempt: AttemptRow, body: FullTestSaveBody, userId: string) {
  const { currentModule, currentQuestion, timeExpiredEvents, extraTimeUsed, moduleTimerState } = body;
  const modules = await attemptModules(attempt);
  const locked = new Set(completedModulesOf(attempt.moduleTimerState, modules.length));
  await Promise.all([
    prisma.fullPracticeTestAttempt.update({
      where: { id: attempt.id },
      data: {
        currentModule: Number.isInteger(currentModule) ? (currentModule as number) : attempt.currentModule,
        currentQuestion: Number.isInteger(currentQuestion) ? (currentQuestion as number) : attempt.currentQuestion,
        timeExpiredEvents: Number.isInteger(timeExpiredEvents) ? (timeExpiredEvents as number) : attempt.timeExpiredEvents,
        extraTimeUsed:
          Number.isInteger(extraTimeUsed) && (extraTimeUsed as number) >= 0 ? (extraTimeUsed as number) : attempt.extraTimeUsed,
      },
    }),
    markUserActive(userId),
    saveFullTestTimerState(attempt.id, moduleTimerState),
  ]);

  const moduleByQuestionId = new Map<string, string>();
  modules.forEach((testModule, index) => {
    if (locked.has(index)) return;
    for (const item of testModule.questions) moduleByQuestionId.set(item.questionId, testModule.id);
  });
  const allowedIds = new Set(moduleByQuestionId.keys());
  const answerMap = body.answers && typeof body.answers === "object" ? (body.answers as Record<string, string>) : {};
  const timeMap =
    body.timeSpentByQuestion && typeof body.timeSpentByQuestion === "object"
      ? (body.timeSpentByQuestion as Record<string, number>)
      : {};
  const { byQuestion: reviewMeta, markedIds } = reviewMetaByQuestion(body, allowedIds);
  // A checked question keeps the answer it was checked with ("Show explanations in the player").
  const checkedIds = new Set(
    (await prisma.fullPracticeTestAnswer.findMany({ where: { attemptId: attempt.id, checkedAt: { not: null } }, select: { questionId: true } })).map(
      (row) => row.questionId,
    ),
  );

  // One upsert per question with everything the payload carries for it.
  const questionIds = new Set<string>([...Object.keys(answerMap), ...Object.keys(timeMap), ...reviewMeta.keys()]);
  await Promise.all(
    [...questionIds].map((questionId) => {
      const moduleId = moduleByQuestionId.get(questionId);
      if (!moduleId) return Promise.resolve();
      const data = {
        moduleId,
        ...(questionId in answerMap && !checkedIds.has(questionId) ? { answer: answerMap[questionId] || null } : {}),
        ...(questionId in timeMap ? { timeSpent: Number(timeMap[questionId]) || 0 } : {}),
        ...(reviewMeta.get(questionId) ?? {}),
      };
      return prisma.fullPracticeTestAnswer.upsert({
        where: { attemptId_questionId: { attemptId: attempt.id, questionId } },
        update: data,
        create: { attemptId: attempt.id, questionId, ...data },
      });
    }),
  );
  if (markedIds) {
    await prisma.fullPracticeTestAnswer.updateMany({
      where: { attemptId: attempt.id, markedForReview: true, questionId: { in: [...allowedIds], notIn: [...markedIds] } },
      data: { markedForReview: false },
    });
  }
  return { modules, locked };
}

/** Marks one module as submitted (idempotent). Returns the completed module indexes. */
export async function completeFullTestModule(attemptId: string, moduleIndex: number, moduleCount: number) {
  const state = (await getFullTestProgressState(attemptId, moduleCount)) ?? {
    timers: Array.from({ length: moduleCount }, () => 0),
    phase: "MODULE" as const,
    breakRemaining: 0,
  };
  const completedModules = [...new Set([...(state.completedModules ?? []), moduleIndex])].sort();
  const timers = [...state.timers];
  timers[moduleIndex] = 0;
  await saveFullTestProgressState(attemptId, { ...state, timers, completedModules });
  return completedModules;
}

/**
 * Final grading: raw counts per section (pretest items excluded when FPT_PRETEST_EXCLUSION is on),
 * scaled scores, assignment completed, teacher notification and audit. Answers of submitted modules
 * come from the database; the rest from `answers` (the client's final state).
 */
export async function finalizeFullTestAttempt(input: {
  attempt: AttemptRow;
  body: FullTestSaveBody;
  student: { id: string; name?: string | null };
}) {
  const { attempt, body, student } = input;
  const attemptId = attempt.id;
  const rawExtraTimeUsed = body.extraTimeUsed;
  // Overtime seconds (time worked after a module's limit); never lower than what autosave already recorded.
  const extraTimeUsed = Number.isInteger(rawExtraTimeUsed) && (rawExtraTimeUsed as number) >= 0
    ? Math.max(rawExtraTimeUsed as number, attempt.extraTimeUsed)
    : attempt.extraTimeUsed;
  const timeExpiredEvents = Number.isInteger(body.timeExpiredEvents) ? (body.timeExpiredEvents as number) : attempt.timeExpiredEvents;
  const timeSpentByQuestion =
    body.timeSpentByQuestion && typeof body.timeSpentByQuestion === "object"
      ? (body.timeSpentByQuestion as Record<string, number>)
      : {};

  const excludePretest = await getFeatureSetting("FPT_PRETEST_EXCLUSION");
  const modules = await attemptModules(attempt);
  const locked = new Set(completedModulesOf(attempt.moduleTimerState, modules.length));
  const lockedQuestionIds = new Set(
    modules.flatMap((testModule, index) => (locked.has(index) ? testModule.questions.map((q) => q.questionId) : [])),
  );
  // Stored answers win for submitted modules and for questions the student already checked.
  const stored = await prisma.fullPracticeTestAnswer.findMany({
    where: { attemptId, OR: [{ questionId: { in: [...lockedQuestionIds] } }, { checkedAt: { not: null } }] },
    select: { questionId: true, answer: true },
  });
  const answers: Record<string, string> = {
    ...(body.answers && typeof body.answers === "object" ? (body.answers as Record<string, string>) : {}),
    ...Object.fromEntries(stored.map((row) => [row.questionId, row.answer ?? ""])),
  };

  const allowedIds = new Set(modules.flatMap((testModule) => testModule.questions.map((item) => item.questionId)));
  for (const id of lockedQuestionIds) allowedIds.delete(id);
  const { byQuestion: reviewMeta, markedIds } = reviewMetaByQuestion(body, allowedIds);

  let rwCorrect = 0;
  let rwTotal = 0;
  let mathCorrect = 0;
  let mathTotal = 0;
  const graded: { questionId: string; moduleId: string; answer: string; isCorrect: boolean; isLocked: boolean }[] = [];
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
      graded.push({ questionId: item.questionId, moduleId: testModule.id, answer, isCorrect, isLocked: lockedQuestionIds.has(item.questionId) });
    }
  }

  const rwScore = await scaledScore("RW", rwCorrect, rwTotal);
  const mathScore = await scaledScore("MATH", mathCorrect, mathTotal);
  const scores = { rwScore, mathScore, totalScore: rwScore + mathScore };
  const raw = { rwCorrect, rwTotal, mathCorrect, mathTotal };
  const submittedAt = new Date();

  // One transaction: every graded answer + the IN_PROGRESS → SUBMITTED transition. Only the request
  // that makes the transition grades and notifies; a second submit (two tabs, a retried request) or a
  // teacher's Invalidate in between leaves the attempt as it is.
  const transitioned = await prisma.$transaction(async (tx) => {
    for (const row of graded) {
      await tx.fullPracticeTestAnswer.upsert({
        where: { attemptId_questionId: { attemptId, questionId: row.questionId } },
        update: {
          moduleId: row.moduleId,
          answer: row.answer || null,
          isCorrect: row.isCorrect,
          ...(row.isLocked ? {} : { timeSpent: timeSpentByQuestion?.[row.questionId] ?? undefined }),
          ...(reviewMeta.get(row.questionId) ?? {}),
        },
        create: {
          attemptId,
          moduleId: row.moduleId,
          questionId: row.questionId,
          answer: row.answer || null,
          isCorrect: row.isCorrect,
          timeSpent: timeSpentByQuestion?.[row.questionId] ?? undefined,
          ...(reviewMeta.get(row.questionId) ?? {}),
        },
      });
    }
    if (markedIds) {
      await tx.fullPracticeTestAnswer.updateMany({
        where: { attemptId, markedForReview: true, questionId: { in: [...allowedIds], notIn: [...markedIds] } },
        data: { markedForReview: false },
      });
    }
    const { count } = await tx.fullPracticeTestAttempt.updateMany({
      where: { id: attemptId, status: "IN_PROGRESS" },
      data: {
        status: "SUBMITTED",
        submittedAt,
        rwScore,
        mathScore,
        totalScore: rwScore + mathScore,
        timeExpiredEvents: timeExpiredEvents ?? 0,
        extraTimeUsed: extraTimeUsed ?? 0,
      },
    });
    // Lost the race: roll the grading back (the attempt keeps the result of whoever submitted it).
    if (count === 0) throw new AttemptAlreadyClosed();
    if (attempt.assignmentId) {
      // Only an open assignment becomes COMPLETED.
      await tx.fullPracticeTestAssignment.updateMany({
        where: { id: attempt.assignmentId, status: { in: ["PENDING", "IN_PROGRESS", "OVERDUE"] } },
        data: { status: "COMPLETED" },
      });
    }
    // Keeps the per-module overtime even when the last autosave did not reach the server.
    if (body.moduleTimerState) await saveFullTestTimerState(attemptId, body.moduleTimerState);
    return true;
  }).catch((error) => {
    if (error instanceof AttemptAlreadyClosed) return false;
    throw error;
  });

  if (!transitioned) {
    const current = await prisma.fullPracticeTestAttempt.findUnique({
      where: { id: attemptId },
      select: { status: true, rwScore: true, mathScore: true, totalScore: true },
    });
    // Already submitted (the other request won): same answer as the first submit, nothing re-sent.
    if (current?.status === "SUBMITTED") {
      return {
        alreadySubmitted: true,
        raw,
        scores: { rwScore: current.rwScore ?? rwScore, mathScore: current.mathScore ?? mathScore, totalScore: current.totalScore ?? scores.totalScore },
      };
    }
    throw new NotFoundError("This test was already submitted or closed by your teacher.");
  }

  await markUserActive(student.id, submittedAt);
  await notifyStudentTeachers(student.id, "Test completed", `${student.name ?? "A student"} completed a Test.`, `/teacher/students/${student.id}/tests/${attemptId}`);

  await writeAudit({
    userId: student.id,
    action: "FPT_ATTEMPT_SUBMITTED",
    targetType: "FullPracticeTestAttempt",
    targetId: attemptId,
    outcome: "success",
    metadata: {
      testId: attempt.testId,
      scores,
    },
  });

  return { alreadySubmitted: false, raw, scores };
}

/** Thrown inside the grading transaction when the attempt is no longer IN_PROGRESS (rolls it back). */
class AttemptAlreadyClosed extends Error {}
