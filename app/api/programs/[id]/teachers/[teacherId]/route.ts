import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";

// PATCH /api/programs/[id]/teachers/[teacherId]
// body: { action: "remove" } | { action: "add" }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; teacherId: string }> }
) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, teacherId } = await params;
  const { action } = await req.json();

  const program = await prisma.program.findUnique({ where: { id } });
  if (!program) return NextResponse.json({ error: "Program not found." }, { status: 404 });

  if (action === "remove") {
    const existing = await prisma.programTeacher.findUnique({
      where: { programId_teacherId: { programId: id, teacherId } },
    });
    if (!existing) return NextResponse.json({ error: "Teacher not assigned to this program." }, { status: 404 });

    const updated = await prisma.programTeacher.update({
      where: { programId_teacherId: { programId: id, teacherId } },
      data: { endDate: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "REMOVE_PROGRAM_TEACHER",
        targetType: "ProgramTeacher",
        targetId: `${id}:${teacherId}`,
      },
    });

    return NextResponse.json({ assignment: updated });
  }

  if (action === "add") {
    const teacher = await prisma.user.findFirst({ where: { id: teacherId, role: "TEACHER", active: true } });
    if (!teacher) return NextResponse.json({ error: "Active teacher not found." }, { status: 404 });

    const existing = await prisma.programTeacher.findUnique({
      where: { programId_teacherId: { programId: id, teacherId } },
    });

    const assignment = existing
      ? await prisma.programTeacher.update({
          where: { programId_teacherId: { programId: id, teacherId } },
          data: { endDate: null, startDate: new Date() },
        })
      : await prisma.programTeacher.create({
          data: { programId: id, teacherId, startDate: new Date() },
        });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "ADD_PROGRAM_TEACHER",
        targetType: "ProgramTeacher",
        targetId: `${id}:${teacherId}`,
      },
    });

    return NextResponse.json({ assignment });
  }

  return NextResponse.json({ error: "Invalid action." }, { status: 400 });
}
