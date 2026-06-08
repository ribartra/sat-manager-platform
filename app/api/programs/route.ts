import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireTeacherOrAdmin } from "@/lib/rbac";

export async function GET() {
  const session = await requireTeacherOrAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const programs = await prisma.program.findMany({
    where: {
      active: true,
      ...(session.user.role === "TEACHER"
        ? { teachers: { some: { teacherId: session.user.id, active: true } } }
        : {}),
      OR: [{ contractEndsAt: null }, { contractEndsAt: { gt: new Date() } }],
    },
    include: { teachers: { include: { teacher: { select: { name: true, email: true, active: true } } } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ programs });
}

export async function POST(req: NextRequest) {
  const session = await requireTeacherOrAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, teacherId, contractEndsAt } = await req.json();
  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  const ownerTeacherId = session.user.role === "ADMIN" ? teacherId : session.user.id;
  if (!ownerTeacherId) {
    return NextResponse.json({ error: "Teacher is required." }, { status: 400 });
  }

  const teacher = await prisma.user.findFirst({ where: { id: ownerTeacherId, role: "TEACHER", active: true } });
  if (!teacher) return NextResponse.json({ error: "Active teacher not found." }, { status: 404 });

  const program = await prisma.program.create({
    data: {
      name,
      contractEndsAt: contractEndsAt ? new Date(contractEndsAt) : null,
      teachers: {
        create: {
          teacherId: ownerTeacherId,
          active: true,
        },
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "CREATE_PROGRAM",
      targetType: "Program",
      targetId: program.id,
    },
  });

  return NextResponse.json({ program });
}
