import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getFeatureSetting } from "@/lib/app-settings";
import { notifyMany } from "@/lib/notify";

function ageInYears(birthDate: Date): number {
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) age--;
  return age;
}

// POST /api/programs/[id]/enroll — student requests enrollment
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const enabled = await getFeatureSetting("STUDENT_SELF_ENROLLMENT");
  if (!enabled) {
    await params;
    return NextResponse.json(
      { error: "Student enrollment requests are disabled. A teacher or administrator must enroll the student." },
      { status: 410 }
    );
  }

  if (!["STUDENT", "PARENT"].includes(session.user.role)) {
    return NextResponse.json({ error: "Only students or parents can request enrollment." }, { status: 403 });
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
  if (!program) return NextResponse.json({ error: "Program not found." }, { status: 404 });

  const now = new Date();
  const available =
    program.active &&
    !program.deletedAt &&
    program.startDate <= now &&
    (program.endDate === null || program.endDate > now);

  if (!available) {
    return NextResponse.json({ error: "This program is not currently available for enrollment." }, { status: 400 });
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
      return NextResponse.json({ error: "You are already enrolled in this program." }, { status: 409 });
    }
    if (existing.status === "PENDING") {
      return NextResponse.json({ error: "You already have a pending enrollment request." }, { status: 409 });
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
      title: "Enrollment consent required",
      body: `${session.user.name} has requested to join ${program.name}. Your approval is required before the teacher can confirm enrollment.`,
      href: "/student",
    }).catch(() => {});
  } else {
    await notifyMany(program.teachers.map((teacher) => teacher.teacherId), {
      title: "New enrollment request",
      body: `${session.user.name} has requested to join ${program.name}.`,
      href: "/teacher/programs",
    }).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    status: "PENDING",
    requiresParentApproval: parentApprovalStatus === "PENDING",
  });
}
