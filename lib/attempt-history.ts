import prisma from "@/lib/prisma";
import { completedModulesOf } from "@/lib/full-test-progress";
import { practiceAreaLabel, type PracticeAreaCode } from "@/lib/practice-area";
import { shortSetName } from "@/lib/student-report";
import { summarizeAllQuestionAnswers } from "@/lib/weighted-score";

/**
 * Every practice and Test attempt of a set of students, with try numbers ("Try 2 of 3") and the
 * change vs. the previous counted try of the same assignment (mockup teacher/history.js).
 * Practice rows carry % correct only; Test rows carry SAT section scores — never mixed.
 * Callers pass student ids already scoped to the teacher (studentAccessWhereFor).
 */

export type HistoryKind = "practice" | "test";

export interface HistoryRow {
  id: string;
  kind: HistoryKind;
  studentId: string;
  studentName: string;
  avatarUrl: string | null;
  /** Practice assignment or Test assignment (groups the tries). */
  groupId: string;
  /** Skill (Topic), practice set and Test of the row: the History view filters by them. */
  topicId: string | null;
  practiceSetId: string | null;
  testId: string | null;
  title: string;
  area: PracticeAreaCode | null;
  areaLabel: string | null;
  difficulty: string | null;
  status: string;
  startedAt: Date;
  at: Date;
  tryNumber: number;
  tryCount: number;
  time: number | null;
  // Practice
  pct: number | null;
  correct: number | null;
  total: number | null;
  wrong: number | null;
  blank: number | null;
  // Test
  rw: number | null;
  math: number | null;
  totalScore: number | null;
  modulesDone: number | null;
  /** Practice: % points; Test: { rw, math } points; vs. the previous counted try. */
  change: number | null;
  changeRw: number | null;
  changeMath: number | null;
}

export interface HistoryFilters {
  kind?: HistoryKind;
  area?: PracticeAreaCode;
  status?: "completed" | "progress" | "invalidated";
  from?: Date;
  /** Inclusive end (end of the day). */
  to?: Date;
  /** Practice only: one skill, level or practice set. */
  topicId?: string;
  difficulty?: string;
  practiceSetId?: string;
  /** Tests only: one Test. */
  testId?: string;
}

const COUNTED = "SUBMITTED";

export async function loadAttemptHistory(studentIds: string[], filters: HistoryFilters = {}): Promise<HistoryRow[]> {
  if (studentIds.length === 0) return [];
  const practiceOnly = Boolean(filters.area || filters.topicId || filters.difficulty || filters.practiceSetId);
  const wantPractice = filters.kind !== "test" && !filters.testId;
  const wantTests = filters.kind !== "practice" && !practiceOnly;
  const [practice, tests] = await Promise.all([
    wantPractice
      ? prisma.attempt.findMany({
          where: {
            studentId: { in: studentIds },
            status: { in: ["SUBMITTED", "INVALIDATED", "IN_PROGRESS"] },
            ...(filters.practiceSetId ? { practiceSetId: filters.practiceSetId } : {}),
          },
          orderBy: { startedAt: "asc" },
          select: {
            id: true,
            status: true,
            startedAt: true,
            submittedAt: true,
            totalTime: true,
            scorePercent: true,
            assignmentId: true,
            practiceSetId: true,
            student: { select: { id: true, name: true, avatarUrl: true } },
            answers: { select: { answer: true, isCorrect: true } },
          },
        })
      : Promise.resolve([]),
    wantTests
      ? prisma.fullPracticeTestAttempt.findMany({
          where: { studentId: { in: studentIds }, status: { in: ["SUBMITTED", "INVALIDATED", "IN_PROGRESS"] }, ...(filters.testId ? { testId: filters.testId } : {}) },
          orderBy: { startedAt: "asc" },
          select: {
            id: true,
            status: true,
            startedAt: true,
            submittedAt: true,
            assignmentId: true,
            testId: true,
            rwScore: true,
            mathScore: true,
            totalScore: true,
            moduleTimerState: true,
            student: { select: { id: true, name: true, avatarUrl: true } },
            test: { select: { name: true, _count: { select: { modules: true } } } },
          },
        })
      : Promise.resolve([]),
  ]);

  // The set of each attempt (also for attempts saved without an assignment).
  const setIds = [...new Set(practice.map((a) => a.practiceSetId))];
  const sets = setIds.length
    ? await prisma.practiceSet.findMany({
        where: { id: { in: setIds } },
        select: {
          id: true,
          name: true,
          difficulty: true,
          topicId: true,
          _count: { select: { questions: true } },
          topic: { select: { name: true, domain: { select: { practiceArea: true } } } },
        },
      })
    : [];
  const setById = new Map(sets.map((set) => [set.id, set]));

  const rows: HistoryRow[] = [];

  const practiceGroups = new Map<string, typeof practice>();
  for (const a of practice) {
    const key = a.assignmentId ?? `${a.student.id}:${a.practiceSetId}`;
    (practiceGroups.get(key) ?? practiceGroups.set(key, []).get(key)!).push(a);
  }
  for (const [groupId, tries] of practiceGroups) {
    let previousPct: number | null = null;
    tries.forEach((a, i) => {
      const set = setById.get(a.practiceSetId);
      const questionCount = set?._count.questions ?? 0;
      const score = summarizeAllQuestionAnswers(a.answers);
      const total = Math.max(score.total, questionCount);
      const answered = a.answers.filter((x) => x.answer && x.answer.trim()).length;
      const done = a.status !== "IN_PROGRESS";
      const pct = done ? a.scorePercent ?? (total ? Math.round((score.correct / total) * 100) : null) : null;
      const area = (set?.topic.domain.practiceArea ?? null) as PracticeAreaCode | null;
      rows.push({
        id: a.id,
        kind: "practice",
        studentId: a.student.id,
        studentName: a.student.name,
        avatarUrl: a.student.avatarUrl,
        groupId,
        topicId: set?.topicId ?? null,
        practiceSetId: a.practiceSetId,
        testId: null,
        title: set?.topic.name ?? (set ? shortSetName(set.name) : "Practice set"),
        area,
        areaLabel: area ? practiceAreaLabel(area) : null,
        difficulty: set?.difficulty ?? null,
        status: a.status,
        startedAt: a.startedAt,
        at: a.submittedAt ?? a.startedAt,
        tryNumber: i + 1,
        tryCount: tries.length,
        time: a.totalTime,
        pct,
        correct: done ? score.correct : null,
        total: done ? total : null,
        wrong: done ? answered - score.correct : null,
        blank: done ? total - answered : null,
        rw: null,
        math: null,
        totalScore: null,
        modulesDone: null,
        change: a.status === COUNTED && pct !== null && previousPct !== null ? pct - previousPct : null,
        changeRw: null,
        changeMath: null,
      });
      if (a.status === COUNTED && pct !== null) previousPct = pct;
    });
  }

  const testGroups = new Map<string, typeof tests>();
  for (const a of tests) {
    const key = a.assignmentId ?? `${a.student.id}:${a.testId}`;
    (testGroups.get(key) ?? testGroups.set(key, []).get(key)!).push(a);
  }
  for (const [groupId, tries] of testGroups) {
    let previous: { rw: number | null; math: number | null } | null = null;
    tries.forEach((a, i) => {
      const counted = a.status === COUNTED;
      rows.push({
        id: a.id,
        kind: "test",
        studentId: a.student.id,
        studentName: a.student.name,
        avatarUrl: a.student.avatarUrl,
        groupId,
        topicId: null,
        practiceSetId: null,
        testId: a.testId,
        title: a.test.name,
        area: null,
        areaLabel: null,
        difficulty: null,
        status: a.status,
        startedAt: a.startedAt,
        at: a.submittedAt ?? a.startedAt,
        tryNumber: i + 1,
        tryCount: tries.length,
        time: null,
        pct: null,
        correct: null,
        total: null,
        wrong: null,
        blank: null,
        rw: a.status === "IN_PROGRESS" ? null : a.rwScore,
        math: a.status === "IN_PROGRESS" ? null : a.mathScore,
        totalScore: a.status === "IN_PROGRESS" ? null : a.totalScore,
        modulesDone: a.status === "IN_PROGRESS" ? completedModulesOf(a.moduleTimerState, a.test._count.modules || 4).length : null,
        change: null,
        changeRw: counted && previous?.rw != null && a.rwScore != null ? a.rwScore - previous.rw : null,
        changeMath: counted && previous?.math != null && a.mathScore != null ? a.mathScore - previous.math : null,
      });
      if (counted) previous = { rw: a.rwScore, math: a.mathScore };
    });
  }

  // Filters that only narrow the list (try numbers and changes above use the whole history).
  return rows
    .filter((r) => (filters.area ? r.area === filters.area : true))
    .filter((r) => (filters.topicId ? r.topicId === filters.topicId : true) && (filters.difficulty ? r.difficulty === filters.difficulty : true))
    .filter((r) =>
      filters.status === "completed"
        ? r.status === "SUBMITTED"
        : filters.status === "progress"
          ? r.status === "IN_PROGRESS"
          : filters.status === "invalidated"
            ? r.status === "INVALIDATED"
            : true,
    )
    .filter((r) => (filters.from ? r.at >= filters.from : true) && (filters.to ? r.at <= filters.to : true))
    .sort((a, b) => b.at.getTime() - a.at.getTime());
}
