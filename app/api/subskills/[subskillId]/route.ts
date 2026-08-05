import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ subskillId: string }>;
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { subskillId } = await params;
  const { name } = await req.json();
  const subskill = await prisma.subskill.update({ where: { id: subskillId }, data: { name } });
  if (subskill.taxonomyNodeId) {
    await prisma.taxonomyNode.update({
      where: { id: subskill.taxonomyNodeId },
      data: { name, label: name, active: true },
    });
  }
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "UPDATE_SUBSKILL",
      targetType: "Subskill",
      targetId: subskillId,
      metadata: JSON.stringify({ name }),
    },
  });
  return NextResponse.json(subskill);
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { subskillId } = await params;
  const questionCount = await prisma.question.count({ where: { subskillId } });
  if (questionCount > 0) {
    return NextResponse.json({ error: "Subskills with questions cannot be deleted." }, { status: 409 });
  }
  const subskill = await prisma.subskill.delete({ where: { id: subskillId } });
  if (subskill.taxonomyNodeId) {
    await prisma.taxonomyNode.update({
      where: { id: subskill.taxonomyNodeId },
      data: { active: false },
    });
  }
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "DELETE_SUBSKILL",
      targetType: "Subskill",
      targetId: subskillId,
    },
  });
  return NextResponse.json({ ok: true });
}
