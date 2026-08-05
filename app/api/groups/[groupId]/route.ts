import { NextRequest, NextResponse } from "next/server";
import { getFeatureSetting } from "@/lib/app-settings";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";

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

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await requireGroupAccess();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { groupId } = await params;
  const body = (await req.json().catch(() => ({}))) as { name?: string; schedule?: string | null };
  if (body.name !== undefined && !body.name.trim()) return NextResponse.json({ error: "Group name is required." }, { status: 400 });

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
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await requireGroupAccess();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { groupId } = await params;
  const [group, assignments] = await Promise.all([
    prisma.group.findUnique({ where: { id: groupId } }),
    prisma.groupAssignment.count({ where: { groupId } }),
  ]);
  if (!group) return NextResponse.json({ error: "Group not found." }, { status: 404 });
  if (assignments > 0) return NextResponse.json({ error: "Remove group assignments before deleting this group." }, { status: 409 });

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
}
