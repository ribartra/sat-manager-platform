import { NextRequest, NextResponse } from "next/server";
import { getFeatureSetting } from "@/lib/app-settings";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { parseDueDate, parseUnlockDate, upsertPracticeAssignment, type AssignmentOutcome } from "@/lib/assignments";
import { studentAccessWhereFor } from "@/lib/program-scope";

export async function POST(req: NextRequest) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { studentIds, practiceSetIds, dueDate, unlockAt, locked, sourceGroupId, feedbackMode } = await req.json();
  const resolvedFeedbackMode = feedbackMode === "IMMEDIATE" ? "IMMEDIATE" : "AFTER_SET";
  if (sourceGroupId && session.user.role !== "ADMIN") {
    const enabled = await getFeatureSetting("TEACHER_GROUP_MANAGEMENT");
    if (!enabled) return NextResponse.json({ error: "Teacher group assignment is disabled." }, { status: 403 });
  }

  const requestedStudentIds = Array.isArray(studentIds) ? studentIds.filter((id) => typeof id === "string") : [];
  const requestedPracticeSetIds = Array.isArray(practiceSetIds) ? practiceSetIds.filter((id) => typeof id === "string") : [];

  if (requestedStudentIds.length === 0 || requestedPracticeSetIds.length === 0) {
    return NextResponse.json({ error: "Student and practice set selection is required." }, { status: 400 });
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
      where: { id: { in: requestedPracticeSetIds }, status: "PUBLISHED" },
      select: { id: true, name: true },
    }),
  ]);

  const allowedStudentIds = new Set(allowedStudents.map((student) => student.id));
  const publishedPracticeSetIds = new Set(publishedPracticeSets.map((practiceSet) => practiceSet.id));
  const inaccessibleStudentIds = requestedStudentIds.filter((studentId) => !allowedStudentIds.has(studentId));
  const unavailablePracticeSetIds = requestedPracticeSetIds.filter((practiceSetId) => !publishedPracticeSetIds.has(practiceSetId));

  if (inaccessibleStudentIds.length > 0) {
    return NextResponse.json({ error: "One or more students are outside your program scope." }, { status: 403 });
  }

  if (unavailablePracticeSetIds.length > 0) {
    return NextResponse.json({ error: "Only published practice sets can be assigned." }, { status: 400 });
  }

  if (sourceGroupId) {
    const group = await prisma.group.findUnique({
      where: { id: sourceGroupId },
      include: { members: { select: { userId: true } } },
    });
    if (!group) return NextResponse.json({ error: "Group not found." }, { status: 404 });
    const groupMemberIds = new Set(group.members.map((member) => member.userId));
    if (requestedStudentIds.some((studentId) => !groupMemberIds.has(studentId))) {
      return NextResponse.json({ error: "Group assignment can only target current group members." }, { status: 400 });
    }
  }

  const resolvedDueDate = parseDueDate(dueDate);
  const resolvedUnlockAt = parseUnlockDate(unlockAt);
  const resolvedLocked = locked === true;
  if (sourceGroupId) {
    for (const practiceSetId of requestedPracticeSetIds) {
      await prisma.groupAssignment.upsert({
        where: { groupId_practiceSetId: { groupId: sourceGroupId, practiceSetId } },
        update: {
          assignedById: session.user.id,
          dueDate: resolvedDueDate,
          unlockAt: resolvedUnlockAt,
          locked: resolvedLocked,
        },
        create: {
          groupId: sourceGroupId,
          practiceSetId,
          assignedById: session.user.id,
          dueDate: resolvedDueDate,
          unlockAt: resolvedUnlockAt,
          locked: resolvedLocked,
        },
      });
    }
  }

  // Assigning again never duplicates: pending assignments get the new settings,
  // completed/overdue ones are reopened (see upsertPracticeAssignment).
  const counts: Record<AssignmentOutcome, number> = { created: 0, updated: 0, reassigned: 0, unchanged: 0 };
  for (const studentId of requestedStudentIds) {
    for (const practiceSetId of requestedPracticeSetIds) {
      const practiceSet = publishedPracticeSets.find((set) => set.id === practiceSetId);
      const { outcome } = await upsertPracticeAssignment({
        studentId,
        practiceSetId,
        practiceSetName: practiceSet?.name ?? "A practice set was assigned.",
        assignedById: session.user.id,
        dueDate: resolvedDueDate,
        unlockAt: resolvedUnlockAt,
        locked: resolvedLocked,
        feedbackMode: resolvedFeedbackMode,
        sourceGroupId: sourceGroupId ?? null,
      });
      counts[outcome] += 1;
    }
  }

  // `skipped` kept for older clients: assignments that needed no change.
  return NextResponse.json({ ...counts, skipped: counts.unchanged });
}
