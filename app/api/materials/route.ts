import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { getFeatureSetting } from "@/lib/app-settings";

export async function POST(req: NextRequest) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await getFeatureSetting("MATERIALS_MODULE"))) {
    return NextResponse.json({ error: "Materials module is disabled." }, { status: 403 });
  }

  const { title, description, body, url, topicId, status } = await req.json();
  if (!title || typeof title !== "string") {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const material = await prisma.studyMaterial.create({
    data: {
      title: title.trim(),
      description: typeof description === "string" ? description.trim() || null : null,
      body: typeof body === "string" ? body.trim() || null : null,
      url: typeof url === "string" ? url.trim() || null : null,
      topicId: typeof topicId === "string" && topicId ? topicId : null,
      status: typeof status === "string" ? status : "PUBLISHED",
      createdById: session.user.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "CREATE_STUDY_MATERIAL",
      targetType: "StudyMaterial",
      targetId: material.id,
    },
  });

  return NextResponse.json({ material });
}
