// Pending work (practice sets and Tests assigned and not finished: not started, in progress or
// overdue) of a set of students, for the "Pending" lists: the panels in the views show the first 10
// and "See all N pending →" opens the full list (teacher /teacher/pending, student /student/pending),
// 25 per page with the same filters as History (lib/history-params.ts) plus a status and a period on
// the assigned date. Callers pass student ids already scoped to the viewer.
import prisma from "@/lib/prisma";
import { refreshAssignmentStates } from "@/lib/assignments";
import { practiceAreaLabel, type PracticeAreaCode } from "@/lib/practice-area";
import { shortSetName } from "@/lib/student-report";

/** How many pending items a panel shows before "See all N pending →". */
export const PENDING_PREVIEW = 10;

export type PendingStatus = "PENDING" | "IN_PROGRESS" | "OVERDUE";
const OPEN: PendingStatus[] = ["PENDING", "IN_PROGRESS", "OVERDUE"];

export interface PendingRow {
  /** Assignment id (practice) or Test assignment id. */
  id: string;
  kind: "practice" | "test";
  studentId: string;
  studentName: string;
  title: string;
  /** Content source of the set / Test (College Board, Innovator…). */
  sourceName: string | null;
  area: PracticeAreaCode | null;
  areaLabel: string | null;
  difficulty: string | null;
  status: PendingStatus;
  /** Can't be started yet: its open date is ahead, or the teacher keeps it closed. */
  locked: boolean;
  assignedAt: Date;
  /** Open date: the assignment's, else the day it was assigned. */
  opensAt: Date;
  dueDate: Date | null;
  practiceSetId: string | null;
  testId: string | null;
}

export interface PendingFilters {
  kind?: "practice" | "test";
  area?: PracticeAreaCode;
  status?: PendingStatus;
  /** Period on the assigned date. */
  from?: Date;
  to?: Date;
}

export async function loadPending(studentIds: string[], filters: PendingFilters = {}): Promise<PendingRow[]> {
  if (studentIds.length === 0) return [];
  await refreshAssignmentStates(new Date());
  const statuses = filters.status ? [filters.status] : OPEN;
  const assigned = filters.from || filters.to ? { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } } : {};
  const [practice, tests] = await Promise.all([
    filters.kind === "test"
      ? Promise.resolve([])
      : prisma.assignment.findMany({
          where: {
            studentId: { in: studentIds },
            status: { in: statuses },
            ...assigned,
            ...(filters.area ? { practiceSet: { topic: { domain: { practiceArea: filters.area } } } } : {}),
          },
          select: {
            id: true,
            status: true,
            locked: true,
            unlockAt: true,
            createdAt: true,
            dueDate: true,
            student: { select: { id: true, name: true } },
            practiceSet: { select: { id: true, name: true, difficulty: true, source: { select: { name: true } }, topic: { select: { name: true, domain: { select: { practiceArea: true } } } } } },
          },
        }),
    filters.kind === "practice" || filters.area
      ? Promise.resolve([])
      : prisma.fullPracticeTestAssignment.findMany({
          where: { studentId: { in: studentIds }, status: { in: statuses }, ...assigned },
          select: { id: true, status: true, createdAt: true, dueDate: true, unlockAt: true, testId: true, student: { select: { id: true, name: true } }, test: { select: { name: true, source: { select: { name: true } } } } },
        }),
  ]);
  const rows: PendingRow[] = [
    ...practice.map((a) => {
      const area = (a.practiceSet.topic.domain.practiceArea ?? null) as PracticeAreaCode | null;
      return {
        id: a.id,
        kind: "practice" as const,
        studentId: a.student.id,
        studentName: a.student.name,
        title: a.practiceSet.topic.name || shortSetName(a.practiceSet.name),
        sourceName: a.practiceSet.source?.name ?? null,
        area,
        areaLabel: area ? practiceAreaLabel(area) : null,
        difficulty: a.practiceSet.difficulty,
        status: a.status as PendingStatus,
        locked: a.locked || Boolean(a.unlockAt && a.unlockAt > new Date()),
        assignedAt: a.createdAt,
        opensAt: a.unlockAt ?? a.createdAt,
        dueDate: a.dueDate,
        practiceSetId: a.practiceSet.id,
        testId: null,
      };
    }),
    ...tests.map((a) => ({
      id: a.id,
      kind: "test" as const,
      studentId: a.student.id,
      studentName: a.student.name,
      title: a.test.name,
      sourceName: a.test.source?.name ?? null,
      area: null,
      areaLabel: null,
      difficulty: null,
      status: a.status as PendingStatus,
      // Open date still ahead: can't be started until then.
      locked: Boolean(a.unlockAt && a.unlockAt > new Date()),
      assignedAt: a.createdAt,
      opensAt: a.unlockAt ?? a.createdAt,
      dueDate: a.dueDate,
      practiceSetId: null,
      testId: a.testId,
    })),
  ];
  // Overdue first, then by due date (no due date last), then newest assigned.
  const rank = (r: PendingRow) => (r.status === "OVERDUE" ? 0 : 1);
  return rows.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (a.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER) ||
      b.assignedAt.getTime() - a.assignedAt.getTime(),
  );
}

export const PENDING_STATUS_OPTIONS: { value: PendingStatus; label: string }[] = [
  { value: "PENDING", label: "Not started" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "OVERDUE", label: "Overdue" },
];

/** The full pending list: `/teacher/pending` (with `student`) or `/student/pending`. */
export function pendingHref(
  base: "/teacher/pending" | "/student/pending",
  params: { student?: string; type?: "practice" | "tests"; area?: "math" | "reading" | "writing"; status?: PendingStatus },
): string {
  const query = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => Boolean(e[1])));
  return query.toString() ? `${base}?${query.toString()}` : base;
}
