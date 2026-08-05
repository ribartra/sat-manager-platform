import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getFeatureSetting } from "@/lib/app-settings";
import { requireTeacherOrAdmin, requireAdmin } from "@/lib/rbac";
import { notifyMany } from "@/lib/notify";

// GET /api/programs/[id] — full program details (teacher or admin)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireTeacherOrAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (session.user.role === "TEACHER") {
    const enabled = await getFeatureSetting("TEACHER_PROGRAM_MANAGEMENT");
    if (!enabled) return NextResponse.json({ error: "Teacher program management is disabled." }, { status: 403 });
  }

  const { id } = await params;

  const program = await prisma.program.findUnique({
    where: { id },
    include: {
      teachers: {
        include: { teacher: { select: { id: true, name: true, email: true } } },
        orderBy: { startDate: "asc" },
      },
      enrollments: {
        include: { student: { select: { id: true, name: true } } },
        orderBy: { enrolledAt: "desc" },
      },
    },
  });

  if (!program) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (session.user.role === "TEACHER") {
    const isAssigned = program.teachers.some(
      (t) => t.teacherId === session.user.id && !t.endDate
    );
    if (!isAssigned) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ program });
}

// PATCH /api/programs/[id] — update name, dates, active; admin can restore
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireTeacherOrAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  const program = await prisma.program.findUnique({ where: { id } });
  if (!program) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (session.user.role === "TEACHER") {
    const assignment = await prisma.programTeacher.findFirst({
      where: { programId: id, teacherId: session.user.id, endDate: null },
    });
    if (!assignment) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.startDate !== undefined) data.startDate = body.startDate ? new Date(body.startDate) : new Date();
  if (body.endDate !== undefined) data.endDate = body.endDate ? new Date(body.endDate) : null;
  if (body.active !== undefined && session.user.role === "ADMIN") data.active = body.active;
  if (body.restore === true && session.user.role === "ADMIN") {
    data.deletedAt = null;
    data.active = true;
  }

  const updated = await prisma.program.update({ where: { id }, data });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: body.restore ? "RESTORE_PROGRAM" : "UPDATE_PROGRAM",
      targetType: "Program",
      targetId: id,
      metadata: JSON.stringify(body),
    },
  });

  return NextResponse.json({ program: updated });
}

// DELETE /api/programs/[id] — soft delete (admin only)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const program = await prisma.program.findUnique({
    where: { id },
    include: {
      teachers: { where: { endDate: null }, select: { teacherId: true } },
      enrollments: { where: { status: "APPROVED", active: true }, select: { studentId: true } },
    },
  });
  if (!program) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (program.deletedAt) return NextResponse.json({ error: "Already deleted." }, { status: 409 });

  const updated = await prisma.program.update({
    where: { id },
    data: { deletedAt: new Date(), active: false },
  });

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "DELETE_PROGRAM", targetType: "Program", targetId: id },
  });

  // Notify enrolled students and active teachers
  const studentIds = program.enrollments.map((e) => e.studentId);
  const teacherIds = program.teachers.map((t) => t.teacherId).filter((tid) => tid !== session.user.id);

  await Promise.all([
    notifyMany(studentIds, {
      title: "Program discontinued",
      body: `${program.name} has been discontinued.`,
    }),
    notifyMany(teacherIds, {
      title: "Program deleted",
      body: `The program "${program.name}" has been removed by an administrator.`,
    }),
  ]).catch(() => {});

  return NextResponse.json({ program: updated });
}
