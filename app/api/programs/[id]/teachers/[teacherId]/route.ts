import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { BadRequestError, ForbiddenError, NotFoundError, withApiErrors } from "@/lib/api-error";

// PATCH /api/programs/[id]/teachers/[teacherId]
// body: { action: "remove" } | { action: "add" }
export const PATCH = withApiErrors(async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; teacherId: string }> }
) {
  const session = await requireAdmin();
  if (!session) return new ForbiddenError("Forbidden").toResponse();

  const { id, teacherId } = await params;
  const { action } = await req.json();

  const program = await prisma.program.findUnique({ where: { id } });
  if (!program) return new NotFoundError("Program not found.").toResponse();

  if (action === "remove") {
    const existing = await prisma.programTeacher.findUnique({
      where: { programId_teacherId: { programId: id, teacherId } },
    });
    if (!existing) return new NotFoundError("Teacher not assigned to this program.").toResponse();

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
    if (!teacher) return new NotFoundError("Active teacher not found.").toResponse();

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

  return new BadRequestError("Invalid action.").toResponse();
});
