import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await requireTeacherOrAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { topicId, name } = await req.json();
  if (!topicId || !name) return NextResponse.json({ error: "Topic and name are required." }, { status: 400 });

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
}
