import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { studentAccessWhereFor } from "@/lib/program-scope";

export async function POST(req: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { studentId } = await params;
  const user = await prisma.user.findFirst({ where: { id: studentId, ...studentAccessWhereFor(session.user) } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.user.update({
    where: { id: studentId },
    data: { active: !user.active },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: updated.active ? "ACTIVATE_STUDENT" : "DEACTIVATE_STUDENT",
      targetType: "User",
      targetId: studentId,
    },
  });

  return NextResponse.json({ active: updated.active });
}
