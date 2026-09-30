import { NextRequest, NextResponse } from "next/server";
import { getFeatureSetting } from "@/lib/app-settings";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, withApiErrors } from "@/lib/api-error";

interface RouteContext {
  params: Promise<{ groupId: string }>;
}

async function requireGroupAccess() {
  const session = await requireTeacherOrAdmin();
  if (!session) return null;
  if (session.user.role !== "ADMIN") {
    const enabled = await getFeatureSetting("TEACHER_GROUP_MANAGEMENT");
    if (!enabled) return null;
  }
  return session;
}

export const PATCH = withApiErrors(async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await requireGroupAccess();
  if (!session) return new ForbiddenError("Forbidden").toResponse();

  const { groupId } = await params;
  const body = (await req.json().catch(() => ({}))) as { name?: string; schedule?: string | null };
  if (body.name !== undefined && !body.name.trim()) return new BadRequestError("Group name is required.").toResponse();

  const group = await prisma.group.update({
    where: { id: groupId },
    data: {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.schedule !== undefined ? { schedule: body.schedule?.trim() || null } : {}),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "UPDATE_GROUP",
      targetType: "Group",
      targetId: groupId,
      metadata: JSON.stringify(body),
    },
  });

  return NextResponse.json(group);
});

export const DELETE = withApiErrors(async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await requireGroupAccess();
  if (!session) return new ForbiddenError("Forbidden").toResponse();

  const { groupId } = await params;
  const [group, assignments] = await Promise.all([
    prisma.group.findUnique({ where: { id: groupId } }),
    prisma.groupAssignment.count({ where: { groupId } }),
  ]);
  if (!group) return new NotFoundError("Group not found.").toResponse();
  if (assignments > 0) return new ConflictError("Remove group assignments before deleting this group.").toResponse();

  await prisma.group.delete({ where: { id: groupId } });
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "DELETE_GROUP",
      targetType: "Group",
      targetId: groupId,
      metadata: JSON.stringify({ name: group.name }),
    },
  });

  return NextResponse.json({ ok: true });
});
