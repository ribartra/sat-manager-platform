import { NextRequest, NextResponse } from "next/server";
import { getFeatureSetting } from "@/lib/app-settings";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma, { atomicBatches } from "@/lib/prisma";
import { ASSIGN_BATCH_SIZE, closeClassroomAssignment, parseDueDate, resolveOpenDate, parseUnlockDate, upsertPracticeAssignment, type PracticeAssignmentOutcome } from "@/lib/assignments";
import { contentScopeFor, studentAccessWhereFor } from "@/lib/program-scope";
import { BadRequestError, ForbiddenError, NotFoundError, ValidationError, withApiErrors } from "@/lib/api-error";
import { isAssignmentContext } from "@/lib/assignment-context";
import { writeAudit } from "@/lib/audit";
import { ACTIVE_SOURCE_WHERE } from "@/lib/content-source";

export const POST = withApiErrors(async function POST(req: NextRequest) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return new ForbiddenError("Forbidden").toResponse();
  }

  const { studentIds, practiceSetIds, dueDate, unlockAt, locked, sourceGroupId, feedbackMode, showExplanations, context } = await req.json();
  // Classroom or Homework is always chosen by the teacher (no default); group rules are Homework.
  const resolvedContext = sourceGroupId ? "HOMEWORK" : context;
  if (!isAssignmentContext(resolvedContext)) {
    return new ValidationError("Choose Classroom or Homework.", ["context"]).toResponse();
  }
  // "Show explanations in the player" (per student; on unless explicitly turned off).
  const resolvedShowExplanations = showExplanations !== false;
  const resolvedFeedbackMode = feedbackMode === "IMMEDIATE" ? "IMMEDIATE" : "AFTER_SET";
  if (sourceGroupId && session.user.role !== "ADMIN") {
    const enabled = await getFeatureSetting("TEACHER_GROUP_MANAGEMENT");
    if (!enabled) return new ForbiddenError("Teacher group assignment is disabled.").toResponse();
  }

  const requestedStudentIds = Array.isArray(studentIds) ? studentIds.filter((id) => typeof id === "string") : [];
  const requestedPracticeSetIds = Array.isArray(practiceSetIds) ? practiceSetIds.filter((id) => typeof id === "string") : [];

  if (requestedStudentIds.length === 0 || requestedPracticeSetIds.length === 0) {
    return new BadRequestError("Student and practice set selection is required.").toResponse();
  }

  const [allowedStudents, publishedPracticeSets] = await Promise.all([
    prisma.user.findMany({
      where: {
        id: { in: requestedStudentIds },
        ...studentAccessWhereFor(session.user),
      },
      select: { id: true },
    }),
    prisma.practiceSet.findMany({
      // Bank scope: sets of a program the teacher teaches.
      // An inactive source's sets can't be assigned (unavailable).
      where: { id: { in: requestedPracticeSetIds }, status: "PUBLISHED", ...ACTIVE_SOURCE_WHERE, ...contentScopeFor(session.user) },
      select: { id: true, name: true, programId: true },
    }),
  ]);

  const allowedStudentIds = new Set(allowedStudents.map((student) => student.id));
  const publishedPracticeSetIds = new Set(publishedPracticeSets.map((practiceSet) => practiceSet.id));
  const inaccessibleStudentIds = requestedStudentIds.filter((studentId) => !allowedStudentIds.has(studentId));
  const unavailablePracticeSetIds = requestedPracticeSetIds.filter((practiceSetId) => !publishedPracticeSetIds.has(practiceSetId));

  if (inaccessibleStudentIds.length > 0) {
    return new ForbiddenError("One or more students are outside your program scope.").toResponse();
  }

  if (unavailablePracticeSetIds.length > 0) {
    return new BadRequestError("Only published practice sets can be assigned.").toResponse();
  }

  // Each student must be enrolled in the program of every set assigned to them.
  const setProgramIds = [...new Set(publishedPracticeSets.map((practiceSet) => practiceSet.programId ?? "__none__"))];
  const enrollments = await prisma.programEnrollment.findMany({
    where: { studentId: { in: requestedStudentIds }, programId: { in: setProgramIds }, active: true, status: "APPROVED" },
    select: { studentId: true, programId: true },
  });
  const enrolled = new Set(enrollments.map((enrollment) => `${enrollment.studentId}:${enrollment.programId}`));
  if (requestedStudentIds.some((studentId) => setProgramIds.some((programId) => !enrolled.has(`${studentId}:${programId}`)))) {
    return new BadRequestError("Only practice sets from the student's program can be assigned.").toResponse();
  }

  if (sourceGroupId) {
    const group = await prisma.group.findUnique({
      where: { id: sourceGroupId },
      include: { members: { select: { userId: true } } },
    });
    if (!group) return new NotFoundError("Group not found.").toResponse();
    const groupMemberIds = new Set(group.members.map((member) => member.userId));
    if (requestedStudentIds.some((studentId) => !groupMemberIds.has(studentId))) {
      return new BadRequestError("Group assignment can only target current group members.").toResponse();
    }
  }

  // Classroom work has no due date: it stays open until finished or assigned as Homework.
  const resolvedDueDate = resolvedContext === "CLASSROOM" ? null : parseDueDate(dueDate);
  const resolvedUnlockAt = parseUnlockDate(unlockAt);
  // "Keep it locked" only exists while Admin › Settings enables it (ASSIGN_LOCKED_OPTION, off by default).
  const resolvedLocked = locked === true && (await getFeatureSetting("ASSIGN_LOCKED_OPTION"));
  if (sourceGroupId) {
    for (const practiceSetId of requestedPracticeSetIds) {
      await prisma.groupAssignment.upsert({
        where: { groupId_practiceSetId: { groupId: sourceGroupId, practiceSetId } },
        update: {
          assignedById: session.user.id,
          dueDate: resolvedDueDate,
          unlockAt: resolveOpenDate(resolvedUnlockAt, new Date(), resolvedLocked),
          locked: resolvedLocked,
          showExplanations: resolvedShowExplanations,
        },
        create: {
          groupId: sourceGroupId,
          practiceSetId,
          assignedById: session.user.id,
          dueDate: resolvedDueDate,
          unlockAt: resolveOpenDate(resolvedUnlockAt, new Date(), resolvedLocked),
          locked: resolvedLocked,
          showExplanations: resolvedShowExplanations,
        },
      });
    }
    // Group-level rule (inherited by future members); per-student rows are audited in upsertPracticeAssignment.
    await writeAudit({
      userId: session.user.id,
      action: "ASSIGN_GROUP_PRACTICE_SET",
      targetType: "Group",
      targetId: sourceGroupId,
      metadata: {
        practiceSetIds: requestedPracticeSetIds,
        dueDate: resolvedDueDate?.toISOString() ?? null,
        unlockAt: resolvedUnlockAt?.toISOString() ?? null,
        locked: resolvedLocked,
      },
    });
  }

  // Assigning again never duplicates: pending assignments get the new settings,
  // completed/overdue ones are reopened (see upsertPracticeAssignment).
  // Written in batches of ASSIGN_BATCH_SIZE pairs per transaction (assignment, notification, audit).
  const counts: Record<PracticeAssignmentOutcome, number> = { created: 0, updated: 0, reassigned: 0, unchanged: 0, blockedByHomework: 0 };
  const setNames = new Map(publishedPracticeSets.map((set) => [set.id, set.name]));
  const pairs = requestedStudentIds.flatMap((studentId) => requestedPracticeSetIds.map((practiceSetId) => ({ studentId, practiceSetId })));
  await atomicBatches(pairs, ASSIGN_BATCH_SIZE, async ({ studentId, practiceSetId }) => {
    const { outcome } = await upsertPracticeAssignment({
      studentId,
      practiceSetId,
      practiceSetName: setNames.get(practiceSetId) ?? "A practice set was assigned.",
      assignedById: session.user.id,
      dueDate: resolvedDueDate,
      unlockAt: resolvedUnlockAt,
      locked: resolvedLocked,
      feedbackMode: resolvedFeedbackMode,
      showExplanations: resolvedShowExplanations,
      context: resolvedContext,
      sourceGroupId: sourceGroupId ?? null,
    });
    counts[outcome] += 1;
  });

  // Homework of a set closes the student's Classroom work on it (submitted as it is, no score shown).
  let classroomClosed = 0;
  if (resolvedContext === "HOMEWORK") {
    for (const { studentId, practiceSetId } of pairs) {
      if (await closeClassroomAssignment({ studentId, practiceSetId, closedById: session.user.id })) classroomClosed += 1;
    }
  }

  // `skipped` kept for older clients: assignments that needed no change.
  return NextResponse.json({ ...counts, skipped: counts.unchanged, classroomClosed });
});
