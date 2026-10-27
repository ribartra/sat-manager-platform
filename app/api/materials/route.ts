import { NextRequest, NextResponse } from "next/server";
import { contentProgramFor } from "@/lib/program-scope";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { getFeatureSetting } from "@/lib/app-settings";
import { BadRequestError, ForbiddenError, withApiErrors } from "@/lib/api-error";

export const POST = withApiErrors(async function POST(req: NextRequest) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return new ForbiddenError("Forbidden").toResponse();
  }
  if (!(await getFeatureSetting("MATERIALS_MODULE"))) {
    return new ForbiddenError("Materials module is disabled.").toResponse();
  }

  const { title, description, body, url, topicId, status, programId: requestedProgramId } = await req.json();
  // The material goes to the bank of a program the author teaches (shared by its teachers).
  const programId = await contentProgramFor(session.user, typeof requestedProgramId === "string" ? requestedProgramId : null);
  if (!title || typeof title !== "string") {
    return new BadRequestError("Title is required").toResponse();
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
      programId,
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
});
