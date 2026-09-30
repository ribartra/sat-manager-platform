import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { notifyUser } from "@/lib/notifications";
import { teacherProgramEnrollmentScope } from "@/lib/program-scope";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, withApiErrors } from "@/lib/api-error";

interface RouteContext {
  params: Promise<{ requestId: string }>;
}

export const PUT = withApiErrors(async function PUT(req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return new ForbiddenError("Forbidden").toResponse();
  }

  const { requestId } = await params;
  const { status } = await req.json();

  if (!["APPROVED", "DENIED"].includes(status)) {
    return new BadRequestError("Invalid unlock request status.").toResponse();
  }

  const scope =
    session.user.role === "TEACHER"
      ? { assignment: { student: { programEnrollments: teacherProgramEnrollmentScope(session.user.id) } } }
      : {};

  const existing = await prisma.unlockRequest.findFirst({
    where: { id: requestId, ...scope },
    include: { assignment: { include: { practiceSet: true } } },
  });
  if (!existing) {
    return new NotFoundError("Not found").toResponse();
  }
  if (existing.status !== "PENDING") {
    return new ConflictError("Unlock request already resolved.").toResponse();
  }

  const request = await prisma.unlockRequest.update({
    where: { id: requestId },
    data: { status, resolvedAt: new Date() },
    include: { assignment: { include: { practiceSet: true } } },
  });

  if (status === "APPROVED") {
    await prisma.assignment.update({
      where: { id: request.assignmentId },
      data: { locked: false, unlockAt: null },
    });
    await notifyUser(request.studentId, "Practice set unlocked", request.assignment.practiceSet.name, "/student");
  } else {
    await notifyUser(request.studentId, "Unlock request denied", request.assignment.practiceSet.name, "/student/content-map");
  }

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: status === "APPROVED" ? "APPROVE_UNLOCK_REQUEST" : "DENY_UNLOCK_REQUEST",
      targetType: "UnlockRequest",
      targetId: request.id,
      metadata: JSON.stringify({ assignmentId: request.assignmentId, studentId: request.studentId }),
    },
  });

  return NextResponse.json(request);
});
