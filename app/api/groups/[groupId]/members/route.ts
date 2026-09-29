import { NextRequest, NextResponse } from "next/server";
import { getFeatureSetting } from "@/lib/app-settings";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (session.user.role !== "ADMIN") {
    const enabled = await getFeatureSetting("TEACHER_GROUP_MANAGEMENT");
    if (!enabled) return NextResponse.json({ error: "Teacher group management is disabled." }, { status: 403 });
  }

  const { groupId } = await params;
  const { userId } = await req.json();

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
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
    }
  }

  return NextResponse.json({ ok: true, inheritedAssignments });
}

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2002",
  );
}
