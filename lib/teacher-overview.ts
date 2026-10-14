import prisma from "@/lib/prisma";
import { resolvePracticeArea, type PracticeAreaCode } from "@/lib/practice-area";
import { summarizeAllQuestionAnswers } from "@/lib/weighted-score";

/**
 * Per-student overview for the teacher Home, the Students roster and the assign panels.
 * Practice (Math / Reading / Writing) is summarised with % correct only; Tests separately with
 * their SAT section scores. The two are never mixed (product rule).
 */

export interface AreaOverview {
  last: { at: Date; pct: number | null; setName: string; attemptId: string } | null;
  avgPct: number | null;
  attempts: number;
  toDo: number;
  overdue: number;
  weakest: { name: string; difficulty: string; pct: number; topicId: string } | null;
}

export interface TestsOverview {
  latest: { id: string; name: string; submittedAt: Date | null; rw: number | null; math: number | null; total: number | null } | null;
  inProgress: number;
  pending: { name: string; overdue: boolean; testId: string }[];
  /** Latest test has a section under 550. */
  lowSection: boolean;
}

export interface StudentOverview {
  id: string;
  name: string;
  email: string;
  active: boolean;
  lastActiveAt: Date | null;
  areas: Record<PracticeAreaCode, AreaOverview>;
  tests: TestsOverview;
}

const AREAS: PracticeAreaCode[] = ["MATH", "READING", "WRITING"];

function emptyArea(): AreaOverview {
  return { last: null, avgPct: null, attempts: 0, toDo: 0, overdue: 0, weakest: null };
}

export async function loadStudentOverviews(studentIds: string[], now = new Date()): Promise<Map<string, StudentOverview>> {
  if (studentIds.length === 0) return new Map();
  const students = await prisma.user.findMany({
    where: { id: { in: studentIds } },
    select: {
      id: true,
      name: true,
      email: true,
      active: true,
      lastActiveAt: true,
      attempts: {
        where: { status: "SUBMITTED" },
        orderBy: { submittedAt: "desc" },
        select: {
          id: true,
          submittedAt: true,
          answers: { select: { isCorrect: true } },
          assignment: {
            select: {
              practiceSet: {
                select: {
                  name: true,
                  difficulty: true,
                  topicId: true,
                  topic: { select: { name: true, domain: { select: { name: true, practiceArea: true } } } },
                },
              },
            },
          },
        },
      },
      assignments: {
        where: { status: { in: ["PENDING", "IN_PROGRESS", "OVERDUE"] } },
        select: { status: true, dueDate: true, practiceSet: { select: { topic: { select: { domain: { select: { name: true, practiceArea: true } } } } } } },
      },
      fullTestAttempts: {
        where: { status: { in: ["SUBMITTED", "IN_PROGRESS"] } },
        orderBy: { startedAt: "desc" },
        select: { id: true, status: true, submittedAt: true, startedAt: true, rwScore: true, mathScore: true, totalScore: true, test: { select: { name: true } } },
      },
      fullTestAssignments: {
        where: { status: { in: ["PENDING", "IN_PROGRESS", "OVERDUE"] } },
        select: { testId: true, dueDate: true, status: true, test: { select: { name: true } } },
      },
    },
  });

  const result = new Map<string, StudentOverview>();
  for (const s of students) {
    const areas = Object.fromEntries(AREAS.map((a) => [a, emptyArea()])) as Record<PracticeAreaCode, AreaOverview>;
    const buckets = new Map<string, { area: PracticeAreaCode; name: string; difficulty: string; topicId: string; correct: number; total: number }>();
    const totals = new Map<PracticeAreaCode, { correct: number; total: number }>();
    for (const attempt of s.attempts) {
      const set = attempt.assignment?.practiceSet;
      if (!set) continue;
      const area = resolvePracticeArea({ practiceArea: set.topic.domain.practiceArea, domainName: set.topic.domain.name });
      if (!area) continue;
      const score = summarizeAllQuestionAnswers(attempt.answers);
      const o = areas[area];
      o.attempts += 1;
      if (!o.last && attempt.submittedAt) {
        o.last = { at: attempt.submittedAt, pct: score.percent, setName: `${set.topic.name} (${set.difficulty.charAt(0)}${set.difficulty.slice(1).toLowerCase()})`, attemptId: attempt.id };
      }
      const t = totals.get(area) ?? { correct: 0, total: 0 };
      t.correct += score.correct;
      t.total += score.total;
      totals.set(area, t);
      const key = `${set.topicId}:${set.difficulty}`;
      const b = buckets.get(key) ?? { area, name: set.topic.name, difficulty: set.difficulty, topicId: set.topicId, correct: 0, total: 0 };
      b.correct += score.correct;
      b.total += score.total;
      buckets.set(key, b);
    }
    for (const area of AREAS) {
      const t = totals.get(area);
      areas[area].avgPct = t && t.total ? Math.round((t.correct / t.total) * 100) : null;
      const weakest = [...buckets.values()]
        .filter((b) => b.area === area && b.total >= 2)
        .map((b) => ({ ...b, pct: Math.round((b.correct / b.total) * 100) }))
        .sort((a, b) => a.pct - b.pct)[0];
      areas[area].weakest = weakest ? { name: weakest.name, difficulty: weakest.difficulty, pct: weakest.pct, topicId: weakest.topicId } : null;
    }
    for (const a of s.assignments) {
      const area = resolvePracticeArea({ practiceArea: a.practiceSet.topic.domain.practiceArea, domainName: a.practiceSet.topic.domain.name });
      if (!area) continue;
      areas[area].toDo += 1;
      if (a.status === "OVERDUE" || (a.dueDate && a.dueDate < now)) areas[area].overdue += 1;
    }
    const submitted = s.fullTestAttempts.filter((a) => a.status === "SUBMITTED").sort((x, y) => (y.submittedAt?.getTime() ?? 0) - (x.submittedAt?.getTime() ?? 0));
    const latest = submitted[0] ?? null;
    const tests: TestsOverview = {
      latest: latest
        ? { id: latest.id, name: latest.test.name, submittedAt: latest.submittedAt, rw: latest.rwScore, math: latest.mathScore, total: latest.totalScore }
        : null,
      inProgress: s.fullTestAttempts.filter((a) => a.status === "IN_PROGRESS").length,
      pending: s.fullTestAssignments.map((a) => ({ name: a.test.name, testId: a.testId, overdue: a.status === "OVERDUE" || Boolean(a.dueDate && a.dueDate < now) })),
      lowSection: Boolean(latest && ((latest.rwScore ?? 800) < 550 || (latest.mathScore ?? 800) < 550)),
    };
    const activity = [
      s.lastActiveAt,
      ...s.attempts.map((a) => a.submittedAt),
      ...s.fullTestAttempts.map((a) => a.submittedAt ?? a.startedAt),
    ].filter((d): d is Date => Boolean(d));
    result.set(s.id, {
      id: s.id,
      name: s.name,
      email: s.email,
      active: s.active,
      lastActiveAt: activity.sort((a, b) => b.getTime() - a.getTime())[0] ?? null,
      areas,
      tests,
    });
  }
  return result;
}

export function isInactive(lastActiveAt: Date | null, now = new Date(), days = 5) {
  if (!lastActiveAt) return true;
  return now.getTime() - lastActiveAt.getTime() >= days * 86_400_000;
}
