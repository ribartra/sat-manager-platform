import { NextRequest, NextResponse } from "next/server";
import { getFeatureSetting } from "@/lib/app-settings";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { ForbiddenError, NotFoundError, withApiErrors } from "@/lib/api-error";
import { writeAudit } from "@/lib/audit";
import { studentAccessWhereFor } from "@/lib/program-scope";

export const POST = withApiErrors(async function POST(req: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return new ForbiddenError("Forbidden").toResponse();
  }
  if (session.user.role !== "ADMIN") {
    const enabled = await getFeatureSetting("TEACHER_GROUP_MANAGEMENT");
    if (!enabled) return new ForbiddenError("Teacher group management is disabled.").toResponse();
  }

  const { groupId } = await params;
  const { userId } = await req.json();
  // Only students the caller can see (program scope for teachers).
  const student = await prisma.user.findFirst({
    where: { id: String(userId ?? ""), ...studentAccessWhereFor(session.user) },
    select: { id: true },
  });
  if (!student) return new NotFoundError("Student not found.").toResponse();

  const groupAssignments = await prisma.groupAssignment.findMany({
    where: { groupId },
    include: { practiceSet: { select: { name: true } } },
  });

  await prisma.groupMembership.upsert({
    where: { userId_groupId: { userId, groupId } },
    update: {},
    create: { userId, groupId },
  });

  let inheritedAssignments = 0;
  const inheritedPracticeSetIds: string[] = [];
  for (const groupAssignment of groupAssignments) {
    const existing = await prisma.assignment.findFirst({
      where: { studentId: userId, practiceSetId: groupAssignment.practiceSetId },
    });
    if (existing) continue;

    try {
      await prisma.assignment.create({
        data: {
          studentId: userId,
          practiceSetId: groupAssignment.practiceSetId,
          assignedById: session.user.id,
          dueDate: groupAssignment.dueDate,
          unlockAt: groupAssignment.unlockAt,
          locked: groupAssignment.locked,
          status: "PENDING",
        },
      });
      inheritedAssignments += 1;
      inheritedPracticeSetIds.push(groupAssignment.practiceSetId);
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
    }
  }

  await writeAudit({
    userId: session.user.id,
    action: "ADD_GROUP_MEMBER",
    targetType: "Group",
    targetId: groupId,
    metadata: { studentId: userId, inheritedAssignments, inheritedPracticeSetIds },
  });

  return NextResponse.json({ ok: true, inheritedAssignments });
});

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2002",
  );
}
