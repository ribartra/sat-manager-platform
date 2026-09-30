import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { teacherProgramEnrollmentScope } from "@/lib/program-scope";
import { ForbiddenError, NotFoundError, withApiErrors } from "@/lib/api-error";

interface RouteContext {
  params: Promise<{ attemptId: string }>;
}

export const POST = withApiErrors(async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return new ForbiddenError("Forbidden").toResponse();
  }

  const { attemptId } = await params;
  const programScope =
    session.user.role === "TEACHER"
      ? teacherProgramEnrollmentScope(session.user.id)
      : undefined;
  const attempt = await prisma.attempt.findFirst({
    where: {
      id: attemptId,
      ...(programScope ? { student: { programEnrollments: programScope } } : {}),
    },
    select: { id: true },
  });
  if (!attempt) return new NotFoundError("Not found").toResponse();

  const { comment } = await req.json();
  const teacherComment = typeof comment === "string" ? comment.trim() : "";

  await prisma.attempt.update({
    where: { id: attemptId },
    data: { teacherComment: teacherComment || null },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "COMMENT_ATTEMPT",
      targetType: "Attempt",
      targetId: attemptId,
      metadata: JSON.stringify({ hasComment: Boolean(teacherComment) }),
    },
  });

  return NextResponse.json({ ok: true });
});
