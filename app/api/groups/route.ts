import { NextRequest, NextResponse } from "next/server";
import { getFeatureSetting } from "@/lib/app-settings";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { ForbiddenError, withApiErrors } from "@/lib/api-error";
import { writeAudit } from "@/lib/audit";

export const POST = withApiErrors(async function POST(req: NextRequest) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return new ForbiddenError("Forbidden").toResponse();
  }
  if (session.user.role !== "ADMIN") {
    const enabled = await getFeatureSetting("TEACHER_GROUP_MANAGEMENT");
    if (!enabled) return new ForbiddenError("Teacher group management is disabled.").toResponse();
  }

  const { name, schedule } = await req.json();
  const group = await prisma.group.create({ data: { name, schedule: schedule || null } });
  await writeAudit({
    userId: session.user.id,
    action: "CREATE_GROUP",
    targetType: "Group",
    targetId: group.id,
    metadata: { name, schedule: schedule || null },
  });
  return NextResponse.json(group);
});
