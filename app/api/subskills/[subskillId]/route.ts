import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { ConflictError, ForbiddenError, withApiErrors } from "@/lib/api-error";

interface RouteContext {
  params: Promise<{ subskillId: string }>;
}

export const PUT = withApiErrors(async function PUT(req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return new ForbiddenError("Forbidden").toResponse();
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
});

export const DELETE = withApiErrors(async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return new ForbiddenError("Forbidden").toResponse();
  const { subskillId } = await params;
  const questionCount = await prisma.question.count({ where: { subskillId } });
  if (questionCount > 0) {
    return new ConflictError("Subskills with questions cannot be deleted.").toResponse();
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
});
