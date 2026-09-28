import prisma from "@/lib/prisma";
import { withSqliteRetry } from "@/lib/sqlite-retry";
import { notifyUser } from "@/lib/notifications";

export async function markOverdueAssignments(now = new Date()) {
  await withSqliteRetry(() => prisma.assignment.updateMany({
      where: {
        dueDate: { lt: now },
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
      data: { status: "OVERDUE" },
    }),
  );
  await withSqliteRetry(() => prisma.fullPracticeTestAssignment.updateMany({
      where: {
        dueDate: { lt: now },
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
      data: { status: "OVERDUE" },
    }),
  );
}

export async function releaseScheduledUnlocks(now = new Date()) {
  await withSqliteRetry(() => prisma.assignment.updateMany({
      where: {
        locked: true,
        unlockAt: { lte: now },
      },
      data: { locked: false, unlockAt: null },
    }),
  );
}

export async function refreshAssignmentStates(now = new Date()) {
  // Keep SQLite writes sequential; concurrent updates can contend on the shared WAL file.
  await markOverdueAssignments(now);
  await releaseScheduledUnlocks(now);
}

// ---------------------------------------------------------------------------
// (Re)assignment rules shared by the Practice Set and Full Practice Test APIs.
// A student has at most one assignment row per set/test (unique constraint), so
// assigning again reuses that row instead of being silently skipped:
//   none                    -> create PENDING
//   PENDING / IN_PROGRESS   -> update its settings (due date, unlock, feedback); keep status + open attempt
//   OVERDUE / COMPLETED     -> reassign: back to PENDING (IN_PROGRESS if an attempt is open), new settings
// Previous attempts stay attached as history (they carry their own snapshots).
// ---------------------------------------------------------------------------

export type AssignmentOutcome = "created" | "updated" | "reassigned" | "unchanged";

/** Offset of the app's teaching timezone (America/Lima, no DST). A due date is the end of that local day. */
export const APP_UTC_OFFSET = "-05:00";

/** "YYYY-MM-DD" (date input) -> end of that day in the app timezone; anything else parses as-is. */
export function parseDueDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T23:59:59.999${APP_UTC_OFFSET}`)
    : new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Unlock dates open at the start of the local day. */
export function parseUnlockDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T00:00:00.000${APP_UTC_OFFSET}`)
    : new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

const OPEN_STATUSES = new Set(["PENDING", "IN_PROGRESS"]);

function sameTime(a: Date | null | undefined, b: Date | null | undefined) {
  return (a?.getTime() ?? null) === (b?.getTime() ?? null);
}

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "P2002",
  );
}

interface PracticeAssignmentInput {
  studentId: string;
  practiceSetId: string;
  practiceSetName: string;
  assignedById: string;
  dueDate: Date | null;
  unlockAt: Date | null;
  locked: boolean;
  feedbackMode: "IMMEDIATE" | "AFTER_SET";
  sourceGroupId?: string | null;
}

export async function upsertPracticeAssignment(input: PracticeAssignmentInput): Promise<{ outcome: AssignmentOutcome; assignmentId: string }> {
  const { studentId, practiceSetId, practiceSetName, assignedById, dueDate, unlockAt, locked, feedbackMode } = input;
  const audit = (action: string, targetId: string, extra: Record<string, unknown> = {}) =>
    prisma.auditLog.create({
      data: {
        userId: assignedById,
        action,
        targetType: "Assignment",
        targetId,
        metadata: JSON.stringify({
          studentId,
          practiceSetId,
          dueDate: dueDate?.toISOString() ?? null,
          unlockAt: unlockAt?.toISOString() ?? null,
          locked,
          feedbackMode,
          sourceGroupId: input.sourceGroupId ?? null,
          ...extra,
        }),
      },
    });

  let existing = await prisma.assignment.findFirst({
    where: { studentId, practiceSetId },
    include: { attempts: { where: { status: "IN_PROGRESS" }, select: { id: true }, take: 1 } },
  });

  if (!existing) {
    try {
      const created = await prisma.assignment.create({
        data: { studentId, practiceSetId, assignedById, dueDate, unlockAt, locked, feedbackMode, status: "PENDING" },
      });
      await notifyUser(studentId, "New practice set assigned", practiceSetName, "/student");
      await audit("ASSIGN_PRACTICE_SET", created.id);
      return { outcome: "created", assignmentId: created.id };
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      // Lost a race with a concurrent assign: fall through to the update/reassign rules.
      existing = await prisma.assignment.findFirst({
        where: { studentId, practiceSetId },
        include: { attempts: { where: { status: "IN_PROGRESS" }, select: { id: true }, take: 1 } },
      });
      if (!existing) throw error;
    }
  }

  if (OPEN_STATUSES.has(existing.status)) {
    // Still pending: apply the new settings without duplicating. An empty due date keeps the current one.
    const nextDueDate = dueDate ?? existing.dueDate;
    const changed =
      !sameTime(existing.dueDate, nextDueDate) ||
      !sameTime(existing.unlockAt, unlockAt) ||
      existing.locked !== locked ||
      existing.feedbackMode !== feedbackMode;
    if (!changed) return { outcome: "unchanged", assignmentId: existing.id };
    await prisma.assignment.update({
      where: { id: existing.id },
      data: { dueDate: nextDueDate, unlockAt, locked, feedbackMode, assignedById },
    });
    await notifyUser(studentId, "Assignment updated", practiceSetName, "/student");
    await audit("UPDATE_ASSIGNMENT", existing.id, { previousDueDate: existing.dueDate?.toISOString() ?? null });
    return { outcome: "updated", assignmentId: existing.id };
  }

  // COMPLETED or OVERDUE: open it again for the student.
  await prisma.assignment.update({
    where: { id: existing.id },
    data: {
      status: existing.attempts.length > 0 ? "IN_PROGRESS" : "PENDING",
      dueDate,
      unlockAt,
      locked,
      feedbackMode,
      assignedById,
    },
  });
  await notifyUser(studentId, "Practice set reassigned", practiceSetName, "/student");
  await audit("REASSIGN_PRACTICE_SET", existing.id, { previousStatus: existing.status });
  return { outcome: "reassigned", assignmentId: existing.id };
}

interface FullTestAssignmentInput {
  studentId: string;
  testId: string;
  testName: string;
  assignedById: string;
  dueDate: Date | null;
}

export async function upsertFullTestAssignment(input: FullTestAssignmentInput): Promise<{ outcome: AssignmentOutcome; assignmentId: string }> {
  const { studentId, testId, testName, assignedById, dueDate } = input;
  const audit = (action: string, targetId: string, extra: Record<string, unknown> = {}) =>
    prisma.auditLog.create({
      data: {
        userId: assignedById,
        action,
        targetType: "FullPracticeTestAssignment",
        targetId,
        metadata: JSON.stringify({ studentId, testId, dueDate: dueDate?.toISOString() ?? null, ...extra }),
      },
    });
  const href = "/student/content-map?area=mocks";

  let existing = await prisma.fullPracticeTestAssignment.findFirst({ where: { testId, studentId } });
  if (!existing) {
    try {
      const created = await prisma.fullPracticeTestAssignment.create({
        data: { testId, studentId, assignedById, dueDate, status: "PENDING" },
      });
      await notifyUser(studentId, "Exam assigned", testName, href);
      await audit("ASSIGN_FULL_PRACTICE_TEST", created.id);
      return { outcome: "created", assignmentId: created.id };
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      existing = await prisma.fullPracticeTestAssignment.findFirst({ where: { testId, studentId } });
      if (!existing) throw error;
    }
  }

  if (OPEN_STATUSES.has(existing.status)) {
    const nextDueDate = dueDate ?? existing.dueDate;
    if (sameTime(existing.dueDate, nextDueDate)) return { outcome: "unchanged", assignmentId: existing.id };
    await prisma.fullPracticeTestAssignment.update({
      where: { id: existing.id },
      data: { dueDate: nextDueDate, assignedById },
    });
    await notifyUser(studentId, "Exam assignment updated", testName, href);
    await audit("UPDATE_FULL_PRACTICE_TEST_ASSIGNMENT", existing.id, { previousDueDate: existing.dueDate?.toISOString() ?? null });
    return { outcome: "updated", assignmentId: existing.id };
  }

  const openAttempt = await prisma.fullPracticeTestAttempt.findFirst({
    where: { assignmentId: existing.id, status: "IN_PROGRESS" },
    select: { id: true },
  });
  await prisma.fullPracticeTestAssignment.update({
    where: { id: existing.id },
    data: { status: openAttempt ? "IN_PROGRESS" : "PENDING", dueDate, assignedById },
  });
  await notifyUser(studentId, "Exam reassigned", testName, href);
  await audit("REASSIGN_FULL_PRACTICE_TEST", existing.id, { previousStatus: existing.status });
  return { outcome: "reassigned", assignmentId: existing.id };
}
