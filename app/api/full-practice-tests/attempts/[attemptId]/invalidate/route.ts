import { NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { teacherProgramEnrollmentScope } from "@/lib/program-scope";
import { applyAttemptLifecycle } from "@/lib/attempt-lifecycle";

interface RouteContext {
  params: Promise<{ attemptId: string }>;
}

/** Invalidate: the attempt stays recorded as it is, marked INVALIDATED, and stops counting toward any score. */
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
  const existing = await prisma.fullPracticeTestAttempt.findFirst({
    where: {
      id: attemptId,
      ...(programScope ? { student: { programEnrollments: programScope } } : {}),
    },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await applyAttemptLifecycle({ kind: "fpt", action: "invalidate", attemptId, actorId: session.user.id, reason });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error === "ALREADY_INVALIDATED" ? "This attempt is already invalidated." : "Not found" },
      { status: result.error === "ALREADY_INVALIDATED" ? 409 : 404 },
    );
  }
  return NextResponse.json({ ok: true, assignmentStatus: result.assignmentStatus ?? null });
}
