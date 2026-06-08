import { NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ attemptId: string }>;
}

export async function POST(_req: Request, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { attemptId } = await params;
  await prisma.attempt.update({ where: { id: attemptId }, data: { status: "INVALIDATED" } });
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "INVALIDATE_ATTEMPT",
      targetType: "Attempt",
      targetId: attemptId,
    },
  });

  return NextResponse.json({ ok: true });
}
