import { NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { getFeatureSetting } from "@/lib/app-settings";

interface RouteContext {
  params: Promise<{ materialId: string }>;
}

export async function POST(_req: Request, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!(await getFeatureSetting("MATERIALS_MODULE"))) {
    return NextResponse.json({ error: "Materials module is disabled." }, { status: 403 });
  }

  const { materialId } = await params;
  const material = await prisma.studyMaterial.findUnique({ where: { id: materialId } });
  if (!material) return NextResponse.json({ error: "Study material not found." }, { status: 404 });

  const copy = await prisma.studyMaterial.create({
    data: {
      title: `${material.title} Copy`,
      description: material.description,
      body: material.body,
      url: material.url,
      topicId: material.topicId,
      status: "DRAFT",
      createdById: session.user.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "DUPLICATE_STUDY_MATERIAL",
      targetType: "StudyMaterial",
      targetId: copy.id,
      metadata: JSON.stringify({ sourceMaterialId: materialId }),
    },
  });

  return NextResponse.json({ material: copy });
}
