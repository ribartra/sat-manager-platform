import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import { notify } from "@/lib/notify";

// PATCH /api/programs/[id]/enrollments/[studentId]
// body: { action: "approve" | "reject" | "remove" }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; studentId: string }> }
) {
  const session = await requireTeacherOrAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, studentId } = await params;
  const { action } = await req.json();

  if (!["approve", "reject", "remove"].includes(action)) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  if (session.user.role === "TEACHER") {
    const assignment = await prisma.programTeacher.findFirst({
      where: { programId: id, teacherId: session.user.id, endDate: null },
    });
    if (!assignment) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const enrollment = await prisma.programEnrollment.findUnique({
    where: { programId_studentId: { programId: id, studentId } },
    include: {
      program: { select: { name: true } },
      student: { select: { name: true } },
    },
  });
  if (!enrollment) return NextResponse.json({ error: "Enrollment not found." }, { status: 404 });

  // Block teacher approval if parental consent is still pending
  if (action === "approve" && enrollment.parentApprovalStatus === "PENDING") {
    return NextResponse.json(
      { error: "Parent consent is required before this enrollment can be approved." },
      { status: 422 }
    );
  }

  let data: Record<string, unknown>;
  let auditAction: string;

  if (action === "approve") {
    data = { status: "APPROVED", active: true };
    auditAction = "APPROVE_ENROLLMENT";
  } else if (action === "reject") {
    data = { status: "REJECTED", active: false };
    auditAction = "REJECT_ENROLLMENT";
  } else {
    data = { active: false };
    auditAction = "REMOVE_ENROLLMENT";
  }

  const updated = await prisma.programEnrollment.update({
    where: { programId_studentId: { programId: id, studentId } },
    data,
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: auditAction,
      targetType: "ProgramEnrollment",
      targetId: `${id}:${studentId}`,
      metadata: JSON.stringify({ programId: id, studentId }),
    },
  });

  const programName = enrollment.program.name;

  if (action === "approve") {
    await notify(studentId, {
      title: "Enrollment approved",
      body: `You have been approved for ${programName}. Welcome!`,
      href: "/student/program",
    }).catch(() => {});
  } else if (action === "reject") {
    await notify(studentId, {
      title: "Enrollment request not approved",
      body: `Your request to join ${programName} was not approved.`,
      href: "/student/program",
    }).catch(() => {});
  } else {
    await notify(studentId, {
      title: "Removed from program",
      body: `You have been removed from ${programName}.`,
      href: "/student/program",
    }).catch(() => {});
  }

  return NextResponse.json({ enrollment: updated });
}
