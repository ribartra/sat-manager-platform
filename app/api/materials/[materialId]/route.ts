import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { getFeatureSetting } from "@/lib/app-settings";

interface RouteContext {
  params: Promise<{ materialId: string }>;
}

async function requireMaterialsEnabled() {
  if (!(await getFeatureSetting("MATERIALS_MODULE"))) {
    return NextResponse.json({ error: "Materials module is disabled." }, { status: 403 });
  }
  return null;
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const disabled = await requireMaterialsEnabled();
  if (disabled) return disabled;

  const { materialId } = await params;
  const { title, description, body, url, topicId, status } = await req.json();

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
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const disabled = await requireMaterialsEnabled();
  if (disabled) return disabled;

  const { materialId } = await params;
  const material = await prisma.studyMaterial.findUnique({ where: { id: materialId } });
  if (!material) return NextResponse.json({ error: "Study material not found." }, { status: 404 });

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
}
