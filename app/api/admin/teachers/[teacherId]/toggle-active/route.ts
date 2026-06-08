import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";

interface RouteContext {
  params: Promise<{ teacherId: string }>;
}

export async function POST(_req: Request, { params }: RouteContext) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { teacherId } = await params;
  const teacher = await prisma.user.findFirst({ where: { id: teacherId, role: "TEACHER" } });
  if (!teacher) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });

  const updated = await prisma.user.update({
    where: { id: teacherId },
    data: { active: !teacher.active },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: updated.active ? "ENABLE_TEACHER" : "DISABLE_TEACHER",
      targetType: "User",
      targetId: teacherId,
    },
  });

  return NextResponse.json({ active: updated.active });
}
