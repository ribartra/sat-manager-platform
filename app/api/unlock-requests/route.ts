import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getFeatureSetting } from "@/lib/app-settings";
import { notifyTeachers } from "@/lib/notifications";
import { requireApprovedSession } from "@/lib/rbac";
import { ApiError, NotFoundError, UnauthorizedError, withApiErrors } from "@/lib/api-error";
import { writeAudit } from "@/lib/audit";

export const POST = withApiErrors(async function POST(req: NextRequest) {
  const session = await requireApprovedSession();
  if (!session) return new UnauthorizedError("Unauthorized").toResponse();

  const enabled = await getFeatureSetting("STUDENT_UNLOCK_REQUESTS");
  if (!enabled) {
    return ApiError.fromStatus(410, "Unlock requests are disabled. Practice access is controlled by scoring rules and teachers.").toResponse();
  }

  const { assignmentId } = await req.json();
  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, studentId: session.user.id },
    include: { practiceSet: true },
  });
  if (!assignment) return new NotFoundError("Not found").toResponse();

  const existing = await prisma.unlockRequest.findFirst({
    where: { assignmentId, studentId: session.user.id, status: "PENDING" },
  });
  if (existing) return NextResponse.json(existing);

  const request = await prisma.unlockRequest.create({
    data: { assignmentId, studentId: session.user.id },
  });
  await writeAudit({
    userId: session.user.id,
    action: "CREATE_UNLOCK_REQUEST",
    targetType: "UnlockRequest",
    targetId: request.id,
    metadata: { assignmentId, practiceSetId: assignment.practiceSetId },
  });
  await notifyTeachers(
    "Unlock requested",
    `${session.user.name} requested access to ${assignment.practiceSet.name}.`,
    `/teacher/students/${session.user.id}`
  );

  return NextResponse.json(request);
});
