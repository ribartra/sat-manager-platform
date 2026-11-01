import { NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { teacherProgramEnrollmentScope } from "@/lib/program-scope";
import { applyAttemptLifecycle } from "@/lib/attempt-lifecycle";
import { ApiError, ForbiddenError, NotFoundError, withApiErrors } from "@/lib/api-error";

interface RouteContext {
  params: Promise<{ attemptId: string }>;
}

/** Reopen: invalidates the attempt (kept as is, no longer counted) and sets the assignment back to PENDING so the student starts a new attempt. */
export const POST = withApiErrors(async function POST(req: Request, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return new ForbiddenError("Forbidden").toResponse();
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
  if (!existing) return new NotFoundError("Not found").toResponse();

  const result = await applyAttemptLifecycle({ kind: "fpt", action: "reopen", attemptId, actorId: session.user.id, reason });
  if (!result.ok) {
    return ApiError.fromStatus(result.error === "ALREADY_INVALIDATED" ? 409 : 404, result.error === "ALREADY_INVALIDATED" ? "This attempt is already invalidated." : "Not found").toResponse();
  }
  return NextResponse.json({ ok: true, assignmentStatus: result.assignmentStatus ?? null });
});
