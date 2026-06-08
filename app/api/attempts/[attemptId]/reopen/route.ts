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
  const attempt = await prisma.attempt.update({
    where: { id: attemptId },
    data: { status: "IN_PROGRESS", submittedAt: null },
  });

  if (attempt.assignmentId) {
    await prisma.assignment.update({ where: { id: attempt.assignmentId }, data: { status: "IN_PROGRESS" } });
  }

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "REOPEN_ATTEMPT",
      targetType: "Attempt",
      targetId: attemptId,
    },
  });

  return NextResponse.json({ ok: true });
}
