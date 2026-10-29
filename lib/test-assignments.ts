import prisma from "@/lib/prisma";
import { getFeatureSetting } from "@/lib/app-settings";
import { fullTestModulesForAttempt, fullTestModulesInclude } from "@/lib/full-test-snapshot";
import { buildTestAttemptView, moduleViewsForTest, type ModuleView, type TestAttemptView } from "@/lib/test-view";
import type { WorkState } from "@/lib/test-view";

/**
 * A student's Tests (Full Practice Test assignments) with status, module progress and every attempt.
 * Shared by the student Tests page/Home and the teacher's per-student Tests tab.
 */

export interface TestAttemptRow {
  id: string;
  status: string;
  startedAt: Date;
  submittedAt: Date | null;
  rwScore: number | null;
  mathScore: number | null;
  totalScore: number | null;
  /** Seconds spent answering (sum of the answers' time), null when nothing was timed. */
  timeTaken: number | null;
  /** Module-level view; built for open attempts (needed for "k of 2 modules"). */
  view: TestAttemptView | null;
  tryNumber: number;
}

export interface StudentTestItem {
  assignmentId: string;
  testId: string;
  name: string;
  /** "TEST N" and source: Tests are shown grouped by number, one version per source. */
  number: number | null;
  sourceName: string;
  sourceOrder: number;
  assignedAt: Date;
  dueDate: Date | null;
  status: string;
  state: WorkState;
  overdue: boolean;
  /** Module tiles: the open attempt, else the Test's modules (all to do). */
  modules: ModuleView[];
  openAttempt: TestAttemptRow | null;
  attempts: TestAttemptRow[];
  lastSubmitted: TestAttemptRow | null;
  /** Per-module results of the latest submitted attempt (Bluebook card module buttons). */
  lastSubmittedView: TestAttemptView | null;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function loadStudentTests(studentId: string): Promise<StudentTestItem[]> {
  const excludePretest = await getFeatureSetting("FPT_PRETEST_EXCLUSION");
  const assignments = await prisma.fullPracticeTestAssignment.findMany({
    where: { studentId },
    include: {
      test: { include: { source: { select: { name: true, sortOrder: true } }, modules: { include: fullTestModulesInclude, orderBy: { order: "asc" } } } },
      attempts: {
        orderBy: { startedAt: "asc" },
        include: { answers: { select: { questionId: true, answer: true, isCorrect: true, timeSpent: true } } },
      },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
  });
  const today = startOfToday();
  return Promise.all(
    assignments.map(async (a) => {
      const attempts: TestAttemptRow[] = await Promise.all(
        a.attempts.map(async (attempt, i) => ({
          id: attempt.id,
          status: attempt.status,
          startedAt: attempt.startedAt,
          submittedAt: attempt.submittedAt,
          rwScore: attempt.rwScore,
          mathScore: attempt.mathScore,
          totalScore: attempt.totalScore,
          timeTaken: attempt.answers.reduce((sum, a) => sum + (a.timeSpent ?? 0), 0) || null,
          tryNumber: i + 1,
          view:
            attempt.status === "IN_PROGRESS"
              ? buildTestAttemptView({
                  modules: await fullTestModulesForAttempt(attempt),
                  status: attempt.status,
                  moduleTimerState: attempt.moduleTimerState,
                  answers: attempt.answers,
                  excludePretest,
                })
              : null,
        })),
      );
      const openAttempt = attempts.find((t) => t.status === "IN_PROGRESS") ?? null;
      const submitted = attempts.filter((t) => t.status === "SUBMITTED");
      const lastSubmitted = submitted.sort((x, y) => (y.submittedAt?.getTime() ?? 0) - (x.submittedAt?.getTime() ?? 0))[0] ?? null;
      const state: WorkState = openAttempt ? "progress" : a.status === "COMPLETED" ? "done" : "todo";
      const lastRaw = lastSubmitted ? a.attempts.find((x) => x.id === lastSubmitted.id) : null;
      const lastSubmittedView = lastRaw
        ? buildTestAttemptView({
            modules: await fullTestModulesForAttempt(lastRaw),
            status: lastRaw.status,
            moduleTimerState: lastRaw.moduleTimerState,
            answers: lastRaw.answers,
            rwScore: lastRaw.rwScore,
            mathScore: lastRaw.mathScore,
            totalScore: lastRaw.totalScore,
            excludePretest,
          })
        : null;
      return {
        assignmentId: a.id,
        testId: a.testId,
        name: a.test.name,
        number: a.test.number,
        sourceName: a.test.source?.name ?? "No source",
        sourceOrder: a.test.source?.sortOrder ?? 999,
        assignedAt: a.createdAt,
        dueDate: a.dueDate,
        status: a.status,
        state,
        // A retake (the Test was already finished once) is never overdue.
        overdue: state !== "done" && !lastSubmitted && Boolean(a.dueDate && a.dueDate < today),
        modules: openAttempt?.view?.modules ?? moduleViewsForTest(a.test.modules),
        openAttempt,
        attempts,
        lastSubmitted,
        lastSubmittedView,
      };
    }),
  );
}

/** Pending first: in progress, then by due date; completed last (latest finish first). */
export function sortTests(items: StudentTestItem[]) {
  const due = (t: StudentTestItem) => t.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const pending = items.filter((t) => t.state !== "done").sort((a, b) => (a.state === "progress" ? -1 : 0) - (b.state === "progress" ? -1 : 0) || due(a) - due(b));
  const done = items
    .filter((t) => t.state === "done")
    .sort((a, b) => (b.lastSubmitted?.submittedAt?.getTime() ?? 0) - (a.lastSubmitted?.submittedAt?.getTime() ?? 0));
  return { pending, done };
}
