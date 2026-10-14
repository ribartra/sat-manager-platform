import prisma from "@/lib/prisma";
import { practiceAreaLabel, PRACTICE_AREA_TABS, type PracticeAreaCode } from "@/lib/practice-area";
import { shortSetName } from "@/lib/student-report";
import { summarizeAllQuestionAnswers } from "@/lib/weighted-score";
import type { WorkState } from "@/lib/test-view";

/**
 * A student's practice sets (Math / Reading / Writing) with status and every try. Percentages only:
 * SAT scaled scores belong to Tests, never to practice.
 */

export interface PracticeTry {
  id: string;
  tryNumber: number;
  submittedAt: Date;
  correct: number;
  total: number;
  pct: number | null;
  time: number | null;
}

export interface PracticeSetItem {
  assignmentId: string;
  practiceSetId: string;
  name: string;
  skill: string;
  skillId: string;
  domain: string;
  area: PracticeAreaCode;
  difficulty: string;
  assignedAt: Date;
  dueDate: Date | null;
  locked: boolean;
  state: WorkState;
  overdue: boolean;
  tries: PracticeTry[];
  last: PracticeTry | null;
  best: number | null;
  /** Answers saved in the open try (for "k of n answered so far"). */
  openAnswered: number | null;
  questionCount: number;
}

export interface AreaPracticeSummary {
  area: PracticeAreaCode;
  label: string;
  total: number;
  done: number;
  todo: number;
  overdue: number;
  avgPct: number | null;
  attempts: number;
  latest: { item: PracticeSetItem; attempt: PracticeTry } | null;
  delta: number | null;
  weakest: { skill: string; skillId: string; pct: number } | null;
  lastPracticed: Date | null;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function loadStudentPractice(studentId: string): Promise<PracticeSetItem[]> {
  const today = startOfToday();
  const now = new Date();
  const assignments = await prisma.assignment.findMany({
    where: { studentId },
    include: {
      practiceSet: {
        include: {
          topic: { include: { domain: true } },
          _count: { select: { questions: true } },
        },
      },
      attempts: {
        where: { status: { in: ["SUBMITTED", "IN_PROGRESS"] } },
        orderBy: { startedAt: "asc" },
        include: { answers: { select: { answer: true, isCorrect: true } } },
      },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
  });
  return assignments
    .map((a): PracticeSetItem | null => {
      const area = a.practiceSet.topic.domain.practiceArea as PracticeAreaCode | null;
      if (!area) return null;
      const submitted = a.attempts.filter((t) => t.status === "SUBMITTED");
      const tries: PracticeTry[] = submitted.map((t, i) => {
        const s = summarizeAllQuestionAnswers(t.answers);
        const total = Math.max(s.total, a.practiceSet._count.questions);
        return {
          id: t.id,
          tryNumber: i + 1,
          submittedAt: t.submittedAt ?? t.startedAt,
          correct: s.correct,
          total,
          pct: t.scorePercent ?? (total ? Math.round((s.correct / total) * 100) : null),
          time: t.totalTime,
        };
      });
      const open = a.attempts.find((t) => t.status === "IN_PROGRESS");
      const last = tries[tries.length - 1] ?? null;
      const state: WorkState = open ? "progress" : tries.length > 0 || a.status === "COMPLETED" ? "done" : "todo";
      const locked = a.locked || Boolean(a.unlockAt && a.unlockAt > now);
      return {
        assignmentId: a.id,
        practiceSetId: a.practiceSetId,
        name: shortSetName(a.practiceSet.name),
        skill: a.practiceSet.topic.name,
        skillId: a.practiceSet.topicId,
        domain: a.practiceSet.topic.domain.name,
        area,
        difficulty: a.practiceSet.difficulty,
        assignedAt: a.createdAt,
        dueDate: a.dueDate,
        locked,
        state,
        overdue: state !== "done" && Boolean(a.dueDate && a.dueDate < today),
        tries,
        last,
        best: tries.reduce<number | null>((m, t) => (t.pct !== null && (m === null || t.pct > m) ? t.pct : m), null),
        openAnswered: open ? open.answers.filter((x) => x.answer && x.answer.trim()).length : null,
        questionCount: a.practiceSet._count.questions,
      };
    })
    .filter((x): x is PracticeSetItem => x !== null);
}

/** Not done first (in progress, then by due date), done after. */
export function sortPracticeSets(items: PracticeSetItem[]) {
  const due = (t: PracticeSetItem) => t.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const rank = (t: PracticeSetItem) => (t.state === "progress" ? 0 : t.state === "todo" ? 1 : 2);
  return [...items].sort((a, b) => rank(a) - rank(b) || due(a) - due(b));
}

export function summarizeArea(items: PracticeSetItem[], area: PracticeAreaCode): AreaPracticeSummary {
  const mine = items.filter((i) => i.area === area);
  const tries = mine
    .flatMap((item) => item.tries.map((attempt) => ({ item, attempt })))
    .sort((a, b) => a.attempt.submittedAt.getTime() - b.attempt.submittedAt.getTime());
  const correct = tries.reduce((s, t) => s + t.attempt.correct, 0);
  const total = tries.reduce((s, t) => s + t.attempt.total, 0);
  const bySkill = new Map<string, { skill: string; correct: number; total: number }>();
  for (const t of tries) {
    const b = bySkill.get(t.item.skillId) ?? { skill: t.item.skill, correct: 0, total: 0 };
    b.correct += t.attempt.correct;
    b.total += t.attempt.total;
    bySkill.set(t.item.skillId, b);
  }
  const weakestEntry = [...bySkill.entries()]
    .filter(([, b]) => b.total > 0)
    .sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total)[0];
  const latest = tries[tries.length - 1] ?? null;
  const prev = tries[tries.length - 2] ?? null;
  return {
    area,
    label: practiceAreaLabel(area),
    total: mine.length,
    done: mine.filter((i) => i.state === "done").length,
    todo: mine.filter((i) => i.state !== "done").length,
    overdue: mine.filter((i) => i.overdue).length,
    avgPct: total ? Math.round((correct / total) * 100) : null,
    attempts: tries.length,
    latest,
    delta: latest && prev && latest.attempt.pct !== null && prev.attempt.pct !== null ? latest.attempt.pct - prev.attempt.pct : null,
    weakest: weakestEntry
      ? { skill: weakestEntry[1].skill, skillId: weakestEntry[0], pct: Math.round((weakestEntry[1].correct / weakestEntry[1].total) * 100) }
      : null,
    lastPracticed: latest?.attempt.submittedAt ?? null,
  };
}

export const PRACTICE_AREAS_IN_ORDER = PRACTICE_AREA_TABS.map((t) => t.practiceArea);
