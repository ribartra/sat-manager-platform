import prisma from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notifications";
import { shortSetName } from "@/lib/student-report";

/**
 * Attempts are atomic (Practice Sets and Full Practice Tests alike):
 * - Invalidate: the attempt stays recorded exactly as it is (answers, scores, snapshots) with
 *   status "INVALIDATED". Every score, average, report and analytics query reads SUBMITTED
 *   attempts only, so it no longer counts anywhere; history lists show it crossed out.
 * - Reopen: invalidates the attempt the same way AND sets the assignment back to "PENDING"
 *   so the student starts a brand-new attempt (the start flows create one when none is open).
 * The caller resolves access (role + program scope) before calling these helpers.
 */
export type AttemptKind = "practice" | "fpt";
export type AttemptAction = "invalidate" | "reopen";

export interface AttemptLifecycleResult {
  ok: boolean;
  error?: "ALREADY_INVALIDATED" | "NOT_FOUND";
  assignmentStatus?: string | null;
}

const AUDIT_ACTION: Record<AttemptKind, Record<AttemptAction, string>> = {
  practice: { invalidate: "INVALIDATE_ATTEMPT", reopen: "REOPEN_ATTEMPT" },
  fpt: { invalidate: "FPT_ATTEMPT_INVALIDATED", reopen: "FPT_ATTEMPT_REOPENED" },
};

export async function applyAttemptLifecycle(input: {
  kind: AttemptKind;
  action: AttemptAction;
  attemptId: string;
  actorId: string;
  reason: string;
}): Promise<AttemptLifecycleResult> {
  const { kind, action, attemptId, actorId, reason } = input;
  const result = kind === "practice" ? await applyPractice(action, attemptId) : await applyFullTest(action, attemptId);
  if (!result.ok || !result.studentId) return result;

  await writeAudit({
    userId: actorId,
    action: AUDIT_ACTION[kind][action],
    targetType: kind === "practice" ? "Attempt" : "FullPracticeTestAttempt",
    targetId: attemptId,
    outcome: "success",
    metadata: {
      ...(reason ? { reason } : {}),
      previousStatus: result.previousStatus,
      assignmentId: result.assignmentId,
      assignmentStatus: result.assignmentStatus,
    },
  });

  const what = kind === "practice" ? "Practice Set" : "Test";
  const name = result.title ? (kind === "practice" ? shortSetName(result.title) : result.title) : null;
  const note = reason ? ` Note from your teacher: ${reason}` : "";
  if (action === "reopen") {
    await notifyUser(
      result.studentId,
      "Result reset",
      `Your teacher reset your ${what}${name ? ` "${name}"` : ""} so you can try again.${note}`,
      kind === "practice" ? "/student/practice" : "/student/tests",
    );
  } else {
    await notifyUser(
      result.studentId,
      "Result set aside",
      `Your teacher set aside a result${name ? ` (${name})` : ""}. It won't count toward your scores.${note}`,
      "/student/history",
    );
  }
  return { ok: true, assignmentStatus: result.assignmentStatus };
}

interface InternalResult extends AttemptLifecycleResult {
  studentId?: string;
  title?: string;
  previousStatus?: string;
  assignmentId?: string | null;
}

async function applyPractice(action: AttemptAction, attemptId: string): Promise<InternalResult> {
  return prisma.$transaction(async (tx) => {
    const attempt = await tx.attempt.findUnique({
      where: { id: attemptId },
      select: { id: true, status: true, studentId: true, assignmentId: true, practiceSetId: true },
    });
    if (!attempt) return { ok: false, error: "NOT_FOUND" as const };
    if (attempt.status === "INVALIDATED") return { ok: false, error: "ALREADY_INVALIDATED" as const };

    await tx.attempt.update({ where: { id: attemptId }, data: { status: "INVALIDATED" } });

    let assignmentStatus: string | null = null;
    if (attempt.assignmentId) {
      const openAttempt = await tx.attempt.findFirst({
        where: { assignmentId: attempt.assignmentId, status: "IN_PROGRESS", id: { not: attemptId } },
        select: { id: true },
      });
      const assignment = await tx.assignment.findUnique({ where: { id: attempt.assignmentId }, select: { status: true } });
      if (action === "reopen") {
        assignmentStatus = openAttempt ? "IN_PROGRESS" : "PENDING";
      } else if (attempt.status === "IN_PROGRESS" && assignment?.status === "IN_PROGRESS" && !openAttempt) {
        // The open attempt was voided: nothing is in progress any more.
        assignmentStatus = "PENDING";
      }
      if (assignmentStatus) {
        await tx.assignment.update({ where: { id: attempt.assignmentId }, data: { status: assignmentStatus } });
      }
    }
    return {
      ok: true,
      studentId: attempt.studentId,
      title: (await tx.practiceSet.findUnique({ where: { id: attempt.practiceSetId }, select: { name: true } }))?.name ?? "a Practice Set",
      previousStatus: attempt.status,
      assignmentId: attempt.assignmentId,
      assignmentStatus,
    };
  });
}

async function applyFullTest(action: AttemptAction, attemptId: string): Promise<InternalResult> {
  return prisma.$transaction(async (tx) => {
    const attempt = await tx.fullPracticeTestAttempt.findUnique({
      where: { id: attemptId },
      select: { id: true, status: true, studentId: true, assignmentId: true, test: { select: { name: true } } },
    });
    if (!attempt) return { ok: false, error: "NOT_FOUND" as const };
    if (attempt.status === "INVALIDATED") return { ok: false, error: "ALREADY_INVALIDATED" as const };

    await tx.fullPracticeTestAttempt.update({ where: { id: attemptId }, data: { status: "INVALIDATED" } });

    let assignmentStatus: string | null = null;
    if (attempt.assignmentId) {
      const openAttempt = await tx.fullPracticeTestAttempt.findFirst({
        where: { assignmentId: attempt.assignmentId, status: "IN_PROGRESS", id: { not: attemptId } },
        select: { id: true },
      });
      const assignment = await tx.fullPracticeTestAssignment.findUnique({
        where: { id: attempt.assignmentId },
        select: { status: true },
      });
      if (action === "reopen") {
        assignmentStatus = openAttempt ? "IN_PROGRESS" : "PENDING";
      } else if (attempt.status === "IN_PROGRESS" && assignment?.status === "IN_PROGRESS" && !openAttempt) {
        assignmentStatus = "PENDING";
      }
      if (assignmentStatus) {
        await tx.fullPracticeTestAssignment.update({ where: { id: attempt.assignmentId }, data: { status: assignmentStatus } });
      }
    }
    return {
      ok: true,
      studentId: attempt.studentId,
      title: attempt.test.name,
      previousStatus: attempt.status,
      assignmentId: attempt.assignmentId,
      assignmentStatus,
    };
  });
}
