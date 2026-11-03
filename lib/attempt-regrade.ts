import prisma from "@/lib/prisma";
import { withSqliteRetry } from "@/lib/sqlite-retry";
import { writeAudit } from "@/lib/audit";
import { isAnswerCorrect } from "@/lib/answer-grading";
import { resolveQuestionType } from "@/lib/question-type";
import { parseSnapshot, type PracticeSetSnapshot } from "@/lib/attempt-snapshots";
import { scorePracticeSetAttempt } from "@/lib/practice-set-scoring";
import { fullTestModulesForAttempt } from "@/lib/full-test-snapshot";
import { fullTestScores, gradeFullTestModules } from "@/lib/full-test-grading";
import { getFeatureSetting } from "@/lib/app-settings";

/**
 * Re-grading after an answer key fix. Attempts store only the student's answers (never a copy of the
 * question), so when a question's key, type or options change, every SUBMITTED practice / Test attempt
 * that has it is graded again against the current question. Only an attempt where some answer turns
 * right/wrong is re-scored (isCorrect, % and scores; never because the score curve changed). Nothing else
 * changes: no messages to anyone, no set locks, no status or dates. Each attempt whose result changed is
 * listed in one REGRADE_ATTEMPTS audit entry.
 */
export type RegradeChange = {
  kind: "practice" | "test";
  attemptId: string;
  studentId: string;
  before: string;
  after: string;
};

export type RegradeResult = { checked: number; changed: RegradeChange[] };

type Options = { dryRun?: boolean; userId?: string | null; reason?: string };

/** Fields that decide grading: a change in any of them re-grades the question's attempts. */
export function gradingFieldsChanged(
  before: { correctAnswer: string; type: string; options: { label: string; text: string }[] },
  after: { correctAnswer?: string | null; type?: string | null; options?: { label: string; text: string }[] | null },
) {
  if (after.correctAnswer != null && after.correctAnswer !== before.correctAnswer) return true;
  if (after.type != null && after.type !== before.type) return true;
  if (after.options != null) {
    const key = (options: { label: string; text: string }[]) =>
      JSON.stringify([...options].map((o) => [o.label, o.text]).sort());
    if (key(after.options) !== key(before.options)) return true;
  }
  return false;
}

async function regradePracticeAttempt(attemptId: string, dryRun: boolean): Promise<RegradeChange | null> {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      studentId: true,
      status: true,
      practiceSetId: true,
      practiceSetSnapshot: true,
      scorePercent: true,
      scaledScore: true,
      scoreSection: true,
      answers: {
        select: {
          id: true,
          answer: true,
          isCorrect: true,
          question: { select: { correctAnswer: true, type: true, options: { select: { label: true, text: true } } } },
        },
      },
    },
  });
  if (!attempt || attempt.status !== "SUBMITTED") return null;

  const answerUpdates: { id: string; isCorrect: boolean }[] = [];
  let correct = 0;
  for (const row of attempt.answers) {
    const isCorrect = row.answer
      ? isAnswerCorrect(row.answer, row.question.correctAnswer, resolveQuestionType(row.question.type, row.question.options))
      : false;
    if (isCorrect) correct += 1;
    if (isCorrect !== row.isCorrect) answerUpdates.push({ id: row.id, isCorrect });
  }
  const structure = parseSnapshot<PracticeSetSnapshot>(attempt.practiceSetSnapshot);
  const total = Math.max(structure?.questions?.length ?? 0, attempt.answers.length);
  const set = await prisma.practiceSet.findUnique({
    where: { id: attempt.practiceSetId },
    select: { topic: { select: { domain: { select: { section: { select: { name: true, label: true } } } } } } },
  });
  const scored = await scorePracticeSetAttempt({
    correct,
    total,
    section: set?.topic.domain.section ?? null,
    scoreSection: attempt.scoreSection,
  });
  // Only a changed right/wrong re-scores the attempt (a later change of the score curve does not).
  if (answerUpdates.length === 0) return null;

  if (!dryRun) {
    await withSqliteRetry(() =>
      prisma.$transaction(async (tx) => {
        for (const update of answerUpdates) {
          await tx.attemptAnswer.update({ where: { id: update.id }, data: { isCorrect: update.isCorrect } });
        }
        await tx.attempt.update({
          where: { id: attempt.id },
          data: { scorePercent: scored.scorePercent, scaledScore: scored.scaledScore, scoreSection: scored.scoreSection },
        });
      }),
    );
  }
  return {
    kind: "practice",
    attemptId: attempt.id,
    studentId: attempt.studentId,
    before: `${attempt.scorePercent ?? "—"}% · ${attempt.scaledScore ?? "—"}`,
    after: `${scored.scorePercent}% · ${scored.scaledScore}`,
  };
}

async function regradeTestAttempt(attemptId: string, excludePretest: boolean, dryRun: boolean): Promise<RegradeChange | null> {
  const attempt = await prisma.fullPracticeTestAttempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      studentId: true,
      status: true,
      testId: true,
      testSnapshot: true,
      rwScore: true,
      mathScore: true,
      totalScore: true,
      answers: { select: { id: true, questionId: true, answer: true, isCorrect: true } },
    },
  });
  if (!attempt || attempt.status !== "SUBMITTED") return null;

  const modules = await fullTestModulesForAttempt(attempt);
  const answers = Object.fromEntries(attempt.answers.map((row) => [row.questionId, row.answer ?? ""]));
  const { graded, raw } = gradeFullTestModules(modules, answers, excludePretest);
  const gradedById = new Map(graded.map((row) => [row.questionId, row.isCorrect]));
  const answerUpdates = attempt.answers.flatMap((row) => {
    const isCorrect = gradedById.get(row.questionId);
    return isCorrect !== undefined && isCorrect !== row.isCorrect ? [{ id: row.id, isCorrect }] : [];
  });
  const scores = await fullTestScores(raw);
  if (answerUpdates.length === 0) return null;

  if (!dryRun) {
    await withSqliteRetry(() =>
      prisma.$transaction(async (tx) => {
        for (const update of answerUpdates) {
          await tx.fullPracticeTestAnswer.update({ where: { id: update.id }, data: { isCorrect: update.isCorrect } });
        }
        await tx.fullPracticeTestAttempt.update({ where: { id: attempt.id }, data: scores });
      }),
    );
  }
  return {
    kind: "test",
    attemptId: attempt.id,
    studentId: attempt.studentId,
    before: `${attempt.totalScore ?? "—"} (RW ${attempt.rwScore ?? "—"}, Math ${attempt.mathScore ?? "—"})`,
    after: `${scores.totalScore} (RW ${scores.rwScore}, Math ${scores.mathScore})`,
  };
}

async function regrade(practiceIds: string[], testIds: string[], options: Options & { questionIds?: string[] }): Promise<RegradeResult> {
  const dryRun = Boolean(options.dryRun);
  const excludePretest = testIds.length ? await getFeatureSetting("FPT_PRETEST_EXCLUSION") : false;
  const changed: RegradeChange[] = [];
  for (const id of practiceIds) {
    const change = await regradePracticeAttempt(id, dryRun);
    if (change) changed.push(change);
  }
  for (const id of testIds) {
    const change = await regradeTestAttempt(id, excludePretest, dryRun);
    if (change) changed.push(change);
  }
  if (!dryRun && changed.length > 0) {
    await writeAudit({
      userId: options.userId ?? null,
      action: "REGRADE_ATTEMPTS",
      targetType: options.questionIds?.length === 1 ? "Question" : null,
      targetId: options.questionIds?.length === 1 ? options.questionIds[0] : null,
      outcome: "success",
      metadata: { reason: options.reason ?? null, questionIds: options.questionIds ?? null, changed },
    });
  }
  return { checked: practiceIds.length + testIds.length, changed };
}

/** Re-grades every SUBMITTED attempt (practice and Test) that answered any of these questions. */
export async function regradeQuestions(questionIds: string[], options: Options = {}): Promise<RegradeResult> {
  const ids = [...new Set(questionIds.filter(Boolean))];
  if (ids.length === 0) return { checked: 0, changed: [] };
  const [practice, tests] = await Promise.all([
    prisma.attemptAnswer.findMany({
      where: { questionId: { in: ids }, attempt: { status: "SUBMITTED" } },
      select: { attemptId: true },
      distinct: ["attemptId"],
    }),
    prisma.fullPracticeTestAnswer.findMany({
      where: { questionId: { in: ids }, attempt: { status: "SUBMITTED" } },
      select: { attemptId: true },
      distinct: ["attemptId"],
    }),
  ]);
  return regrade(
    practice.map((row) => row.attemptId),
    tests.map((row) => row.attemptId),
    { ...options, questionIds: ids },
  );
}

/** Re-grades every SUBMITTED attempt (after a data patch that changed keys, or once after migrating). */
export async function regradeAllAttempts(options: Options = {}): Promise<RegradeResult> {
  const [practice, tests] = await Promise.all([
    prisma.attempt.findMany({ where: { status: "SUBMITTED" }, select: { id: true } }),
    prisma.fullPracticeTestAttempt.findMany({ where: { status: "SUBMITTED" }, select: { id: true } }),
  ]);
  return regrade(
    practice.map((row) => row.id),
    tests.map((row) => row.id),
    options,
  );
}
