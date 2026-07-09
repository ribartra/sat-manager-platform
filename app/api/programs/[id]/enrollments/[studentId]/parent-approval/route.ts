import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notify, notifyMany } from "@/lib/notify";

// PATCH /api/programs/[id]/enrollments/[studentId]/parent-approval
// body: { action: "approve" | "reject" }
// Only accessible by a parent linked to the student.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; studentId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "PARENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: programId, studentId } = await params;
  const { action } = await req.json();

  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  // Verify this parent is linked to the student
  const link = await prisma.parentStudent.findUnique({
    where: { parentId_studentId: { parentId: session.user.id, studentId } },
  });
  if (!link) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const enrollment = await prisma.programEnrollment.findUnique({
    where: { programId_studentId: { programId, studentId } },
    include: {
      program: { select: { name: true, teachers: { where: { endDate: null }, select: { teacherId: true } } } },
      student: { select: { name: true } },
    },
  });
  if (!enrollment) return NextResponse.json({ error: "Enrollment not found." }, { status: 404 });
  if (enrollment.parentApprovalStatus !== "PENDING") {
    return NextResponse.json({ error: "This enrollment does not require parent approval." }, { status: 409 });
  }

  const updated = await prisma.programEnrollment.update({
    where: { programId_studentId: { programId, studentId } },
    data: {
      parentApprovalStatus: action === "approve" ? "APPROVED" : "REJECTED",
      parentApprovedAt: action === "approve" ? new Date() : null,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: action === "approve" ? "PARENT_APPROVE_ENROLLMENT" : "PARENT_REJECT_ENROLLMENT",
      targetType: "ProgramEnrollment",
      targetId: `${programId}:${studentId}`,
    },
  });

  const studentName = enrollment.student.name;
  const programName = enrollment.program.name;

  if (action === "approve") {
    // Notify teachers that parent approved — they can now review
    const teacherIds = enrollment.program.teachers.map((t) => t.teacherId);
    await notifyMany(teacherIds, {
      title: "New enrollment request",
      body: `${studentName} has requested to join ${programName}. Parent consent has been given.`,
      href: "/teacher/programs",
    }).catch(() => {});

    await notify(studentId, {
      title: "Parent approved your enrollment request",
      body: `Your parent approved your request to join ${programName}. Your teacher will review it next.`,
      href: "/student/program",
    }).catch(() => {});
  } else {
    await notify(studentId, {
      title: "Enrollment request not approved",
      body: `Your parent did not approve your request to join ${programName}.`,
      href: "/student/program",
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, parentApprovalStatus: updated.parentApprovalStatus });
}
