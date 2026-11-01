import { NextResponse } from "next/server";
import { contentScopeFor } from "@/lib/program-scope";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { getFeatureSetting } from "@/lib/app-settings";
import { ForbiddenError, NotFoundError, withApiErrors } from "@/lib/api-error";

interface RouteContext {
  params: Promise<{ materialId: string }>;
}

export const POST = withApiErrors(async function POST(_req: Request, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return new ForbiddenError("Forbidden").toResponse();
  if (!(await getFeatureSetting("MATERIALS_MODULE"))) {
    return new ForbiddenError("Materials module is disabled.").toResponse();
  }

  const { materialId } = await params;
  const material = await prisma.studyMaterial.findFirst({ where: { id: materialId, ...contentScopeFor(session.user) } });
  if (!material) return new NotFoundError("Study material not found.").toResponse();

  const copy = await prisma.studyMaterial.create({
    data: {
      title: `${material.title} Copy`,
      description: material.description,
      body: material.body,
      url: material.url,
      topicId: material.topicId,
      status: "DRAFT",
      createdById: session.user.id,
      // The copy stays in the same program's bank.
      programId: material.programId,
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
});
