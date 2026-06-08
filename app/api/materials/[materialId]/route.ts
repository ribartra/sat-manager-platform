import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ materialId: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
