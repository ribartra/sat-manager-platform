import { NextRequest, NextResponse } from "next/server";
import { contentScopeFor } from "@/lib/program-scope";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { getFeatureSetting } from "@/lib/app-settings";
import { ForbiddenError, NotFoundError, withApiErrors } from "@/lib/api-error";

interface RouteContext {
  params: Promise<{ materialId: string }>;
}

async function requireMaterialsEnabled() {
  if (!(await getFeatureSetting("MATERIALS_MODULE"))) {
    return new ForbiddenError("Materials module is disabled.").toResponse();
  }
  return null;
}

export const PATCH = withApiErrors(async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return new ForbiddenError("Forbidden").toResponse();
  }
  const disabled = await requireMaterialsEnabled();
  if (disabled) return disabled;

  const { materialId } = await params;
  const { title, description, body, url, topicId, status } = await req.json();
  // Only materials of a program the teacher teaches (shared bank).
  const existing = await prisma.studyMaterial.findFirst({ where: { id: materialId, ...contentScopeFor(session.user) }, select: { id: true } });
  if (!existing) return new NotFoundError("Study material not found.").toResponse();

  const material = await prisma.studyMaterial.update({
    where: { id: materialId },
    data: {
      title: typeof title === "string" ? title.trim() : undefined,
      description: typeof description === "string" ? description.trim() || null : undefined,
      body: typeof body === "string" ? body.trim() || null : undefined,
      url: typeof url === "string" ? url.trim() || null : undefined,
      topicId: typeof topicId === "string" && topicId ? topicId : null,
      status: typeof status === "string" ? status : undefined,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "UPDATE_STUDY_MATERIAL",
      targetType: "StudyMaterial",
      targetId: material.id,
      metadata: JSON.stringify({ status: material.status }),
    },
  });

  return NextResponse.json({ material });
});

export const DELETE = withApiErrors(async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return new ForbiddenError("Forbidden").toResponse();
  }
  const disabled = await requireMaterialsEnabled();
  if (disabled) return disabled;

  const { materialId } = await params;
  const material = await prisma.studyMaterial.findFirst({ where: { id: materialId, ...contentScopeFor(session.user) } });
  if (!material) return new NotFoundError("Study material not found.").toResponse();

  await prisma.studyMaterial.delete({ where: { id: materialId } });
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "DELETE_STUDY_MATERIAL",
      targetType: "StudyMaterial",
      targetId: materialId,
      metadata: JSON.stringify({ previousStatus: material.status }),
    },
  });

  return NextResponse.json({ ok: true });
});
