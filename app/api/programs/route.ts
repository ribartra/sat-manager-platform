import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import { auth } from "@/lib/auth";

function isAvailable(p: { active: boolean; startDate: Date; endDate: Date | null }) {
  const now = new Date();
  return p.active && p.startDate <= now && (p.endDate === null || p.endDate > now);
}

// GET /api/programs
// Admin → all programs (maestro)
// Teacher → their active assignments only
// Student/Parent → their APPROVED enrollments
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;

  if (role === "ADMIN") {
    const programs = await prisma.program.findMany({
      include: {
        teachers: {
          include: { teacher: { select: { id: true, name: true, email: true, active: true } } },
          orderBy: { startDate: "asc" },
        },
        enrollments: { select: { studentId: true, status: true, active: true } },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ programs: programs.map((p) => ({ ...p, available: isAvailable(p) })) });
  }

  if (role === "TEACHER") {
    const programs = await prisma.program.findMany({
      where: { deletedAt: null, teachers: { some: { teacherId: session.user.id, endDate: null } } },
      include: {
        teachers: {
          include: { teacher: { select: { id: true, name: true, email: true, active: true } } },
          orderBy: { startDate: "asc" },
        },
        enrollments: { select: { studentId: true, status: true, active: true } },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ programs: programs.map((p) => ({ ...p, available: isAvailable(p) })) });
  }

  // Student or Parent: return APPROVED active enrollments
  const enrollments = await prisma.programEnrollment.findMany({
    where: { studentId: session.user.id, status: "APPROVED", active: true },
    include: {
      program: { select: { id: true, name: true, startDate: true, endDate: true, active: true } },
    },
  });
  const programs = enrollments.map((e) => ({ ...e.program, enrolledAt: e.enrolledAt }));
  return NextResponse.json({ programs });
}

// POST /api/programs — Teacher or Admin creates a program
export async function POST(req: NextRequest) {
  const session = await requireTeacherOrAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, teacherId, startDate, endDate } = await req.json();
  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });

  const ownerTeacherId = session.user.role === "ADMIN" ? teacherId : session.user.id;
  if (!ownerTeacherId) return NextResponse.json({ error: "Teacher is required." }, { status: 400 });

  const teacher = await prisma.user.findFirst({ where: { id: ownerTeacherId, role: "TEACHER", active: true } });
  if (!teacher) return NextResponse.json({ error: "Active teacher not found." }, { status: 404 });

  const resolvedStart = startDate ? new Date(startDate) : new Date();

  const program = await prisma.program.create({
    data: {
      name,
      startDate: resolvedStart,
      endDate: endDate ? new Date(endDate) : null,
      teachers: {
        create: { teacherId: ownerTeacherId, startDate: resolvedStart },
      },
    },
  });

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "CREATE_PROGRAM", targetType: "Program", targetId: program.id },
  });

  return NextResponse.json({ program });
}
