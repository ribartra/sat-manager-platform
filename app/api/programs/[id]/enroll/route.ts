import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notifyMany } from "@/lib/notify";

function ageInYears(birthDate: Date): number {
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const m = now.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) age--;
  return age;
}

// POST /api/programs/[id]/enroll — student requests enrollment
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  // Determine if student is a minor with linked parents
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    include: {
      childLinks: { select: { parentId: true } },
    },
  });

  let parentApprovalStatus: string | null = null;
  let parentIds: string[] = [];

  if (student?.birthDate && ageInYears(student.birthDate) < 18) {
    parentIds = student.childLinks.map((l) => l.parentId);
    if (parentIds.length > 0) {
      parentApprovalStatus = "PENDING";
    }
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
    // Rejected: allow re-request
    await prisma.programEnrollment.update({
      where: { programId_studentId: { programId: id, studentId } },
      data: {
        status: "PENDING",
        active: false,
        enrolledAt: new Date(),
        parentApprovalStatus: parentApprovalStatus ?? null,
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
        parentApprovalStatus: parentApprovalStatus ?? null,
      },
    });
  }

  await prisma.auditLog.create({
    data: { userId: studentId, action: "REQUEST_ENROLLMENT", targetType: "Program", targetId: id },
  });

  const studentName = session.user.name;

  if (parentApprovalStatus === "PENDING") {
    // Notify parents first; teachers notified once parent approves
    await notifyMany(parentIds, {
      title: "Enrollment consent required",
      body: `${studentName} has requested to join ${program.name}. Your approval is required before the teacher can confirm enrollment.`,
      href: "/student",
    }).catch(() => {});
  } else {
    // No parental consent needed — notify teachers directly
    const teacherIds = program.teachers.map((t) => t.teacherId);
    await notifyMany(teacherIds, {
      title: "New enrollment request",
      body: `${studentName} has requested to join ${program.name}.`,
      href: "/teacher/programs",
    }).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    status: "PENDING",
    requiresParentApproval: parentApprovalStatus === "PENDING",
  });
}
