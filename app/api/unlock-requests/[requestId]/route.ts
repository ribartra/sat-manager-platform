import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma, { atomic } from "@/lib/prisma";
import { notifyUser } from "@/lib/notifications";
import { shortSetName } from "@/lib/student-report";
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

  // One transaction, and the request changes only while it is still PENDING: two teachers (or a double
  // click) resolving it at once give one resolution, one notification and one audit entry.
  const request = await atomic(async () => {
    const resolved = await prisma.unlockRequest.updateMany({
      where: { id: requestId, status: "PENDING" },
      data: { status, resolvedAt: new Date() },
    });
    if (resolved.count === 0) return null;
    const row = await prisma.unlockRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: { assignment: { include: { practiceSet: true } } },
    });
    if (status === "APPROVED") {
      await prisma.assignment.update({
        where: { id: row.assignmentId },
        // Opened now: the open date is today.
        data: { locked: false, unlockAt: new Date() },
      });
      await notifyUser(row.studentId, "Practice Set unlocked", `${shortSetName(row.assignment.practiceSet.name)} is open now.`, "/student");
    } else {
      await notifyUser(row.studentId, "Unlock request denied", row.assignment.practiceSet.name, "/student/practice");
    }
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: status === "APPROVED" ? "APPROVE_UNLOCK_REQUEST" : "DENY_UNLOCK_REQUEST",
        targetType: "UnlockRequest",
        targetId: row.id,
        metadata: JSON.stringify({ assignmentId: row.assignmentId, studentId: row.studentId }),
      },
    });
    return row;
  });
  if (!request) {
    return new ConflictError("Unlock request already resolved.").toResponse();
  }

  return NextResponse.json(request);
});
