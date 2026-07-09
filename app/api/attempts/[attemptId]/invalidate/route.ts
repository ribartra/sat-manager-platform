import { NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { teacherProgramEnrollmentScope } from "@/lib/program-scope";

interface RouteContext {
  params: Promise<{ attemptId: string }>;
}

export async function POST(req: Request, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { reason?: unknown };
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  const { attemptId } = await params;
  const programScope =
    session.user.role === "TEACHER"
      ? teacherProgramEnrollmentScope(session.user.id)
      : undefined;
  const attempt = await prisma.attempt.findFirst({
    where: {
      id: attemptId,
      ...(programScope ? { student: { programEnrollments: programScope } } : {}),
    },
    select: { id: true },
  });
  if (!attempt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.attempt.update({ where: { id: attemptId }, data: { status: "INVALIDATED" } });
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "INVALIDATE_ATTEMPT",
      targetType: "Attempt",
      targetId: attemptId,
      metadata: reason ? JSON.stringify({ reason }) : null,
    },
  });

  return NextResponse.json({ ok: true });
}
