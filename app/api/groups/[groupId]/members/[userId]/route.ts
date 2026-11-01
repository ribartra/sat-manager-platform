import { NextRequest, NextResponse } from "next/server";
import { getFeatureSetting } from "@/lib/app-settings";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { ForbiddenError, withApiErrors } from "@/lib/api-error";
import { writeAudit } from "@/lib/audit";

export const DELETE = withApiErrors(async function DELETE(req: NextRequest, { params }: { params: Promise<{ groupId: string; userId: string }> }) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return new ForbiddenError("Forbidden").toResponse();
  }
  if (session.user.role !== "ADMIN") {
    const enabled = await getFeatureSetting("TEACHER_GROUP_MANAGEMENT");
    if (!enabled) return new ForbiddenError("Teacher group management is disabled.").toResponse();
  }

  const { groupId, userId } = await params;
  await prisma.groupMembership.delete({ where: { userId_groupId: { userId, groupId } } });
  await writeAudit({
    userId: session.user.id,
    action: "REMOVE_GROUP_MEMBER",
    targetType: "Group",
    targetId: groupId,
    metadata: { studentId: userId },
  });
  return NextResponse.json({ ok: true });
});
