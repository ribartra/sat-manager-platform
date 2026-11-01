import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { BadRequestError, ForbiddenError, withApiErrors } from "@/lib/api-error";

export const POST = withApiErrors(async function POST(req: NextRequest) {
  const session = await requireTeacherOrAdmin();
  if (!session) return new ForbiddenError("Forbidden").toResponse();

  const { topicId, name } = await req.json();
  if (!topicId || !name) return new BadRequestError("Topic and name are required.").toResponse();

  const topic = await prisma.topic.findUnique({ where: { id: topicId }, select: { taxonomyNodeId: true } });
  const subskill = await prisma.subskill.create({ data: { topicId, name } });
  const taxonomyNode = await prisma.taxonomyNode.create({
    data: {
      id: `tax-subskill-${subskill.id}`,
      name,
      label: name,
      type: "SUBSKILL",
      parentId: topic?.taxonomyNodeId ?? `tax-skill-${topicId}`,
      active: true,
    },
  });
  await prisma.subskill.update({
    where: { id: subskill.id },
    data: { taxonomyNodeId: taxonomyNode.id },
  });
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "CREATE_SUBSKILL",
      targetType: "Subskill",
      targetId: subskill.id,
      metadata: JSON.stringify({ topicId, name }),
    },
  });
  return NextResponse.json(subskill);
});
