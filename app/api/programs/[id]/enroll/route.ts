import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getFeatureSetting } from "@/lib/app-settings";
import { notifyMany } from "@/lib/notify";
import { ApiError, BadRequestError, ConflictError, ForbiddenError, NotFoundError, UnauthorizedError, withApiErrors } from "@/lib/api-error";

function ageInYears(birthDate: Date): number {
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) age--;
  return age;
}

// POST /api/programs/[id]/enroll — student requests enrollment
export const POST = withApiErrors(async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return new UnauthorizedError("Unauthorized").toResponse();

  const enabled = await getFeatureSetting("STUDENT_SELF_ENROLLMENT");
  if (!enabled) {
    await params;
    return ApiError.fromStatus(410, "Student enrollment requests are disabled. A teacher or administrator must enroll the student.").toResponse();
  }

  if (!["STUDENT", "PARENT"].includes(session.user.role)) {
    return new ForbiddenError("Only students or parents can request enrollment.").toResponse();
  }

  const { id } = await params;
  const studentId = session.user.id;

  const program = await prisma.program.findUnique({
    where: { id },
    include: {
      teachers: {
        where: { endDate: null },
        select: { teacherId: true },
      },
    },
  });
  if (!program) return new NotFoundError("Program not found.").toResponse();

  const now = new Date();
  const available =
    program.active &&
    !program.deletedAt &&
    program.startDate <= now &&
    (program.endDate === null || program.endDate > now);

  if (!available) {
    return new BadRequestError("This program is not currently available for enrollment.").toResponse();
  }

  const student = await prisma.user.findUnique({
    where: { id: studentId },
    include: { childLinks: { select: { parentId: true } } },
  });

  let parentApprovalStatus: string | null = null;
  let parentIds: string[] = [];

  if (student?.birthDate && ageInYears(student.birthDate) < 18) {
    parentIds = student.childLinks.map((link) => link.parentId);
    if (parentIds.length > 0) parentApprovalStatus = "PENDING";
  }

  const existing = await prisma.programEnrollment.findUnique({
    where: { programId_studentId: { programId: id, studentId } },
  });

  if (existing) {
    if (existing.status === "APPROVED" && existing.active) {
      return new ConflictError("You are already enrolled in this program.").toResponse();
    }
    if (existing.status === "PENDING") {
      return new ConflictError("You already have a pending enrollment request.").toResponse();
    }
    await prisma.programEnrollment.update({
      where: { programId_studentId: { programId: id, studentId } },
      data: {
        status: "PENDING",
        active: false,
        enrolledAt: new Date(),
        parentApprovalStatus,
        parentApprovedAt: null,
      },
    });
  } else {
    await prisma.programEnrollment.create({
      data: {
        programId: id,
        studentId,
        status: "PENDING",
        active: false,
        parentApprovalStatus,
      },
    });
  }

  await prisma.auditLog.create({
    data: { userId: studentId, action: "REQUEST_ENROLLMENT", targetType: "Program", targetId: id },
  });

  if (parentApprovalStatus === "PENDING") {
    await notifyMany(parentIds, {
      title: `Please approve ${session.user.name}'s program request`,
      body: `${session.user.name} asked to join ${program.name}. Approve it so the teacher can add them.`,
      href: "/student",
    }).catch(() => {});
  } else {
    await notifyMany(program.teachers.map((teacher) => teacher.teacherId), {
      title: "New enrollment request",
      body: `${session.user.name} asked to join ${program.name}.`,
      href: "/teacher/programs",
    }).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    status: "PENDING",
    requiresParentApproval: parentApprovalStatus === "PENDING",
  });
});
