import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApprovedSession } from "@/lib/rbac";
import { saveFullTestProgress } from "@/lib/full-test-grading";
import { NotFoundError, UnauthorizedError, withApiErrors } from "@/lib/api-error";

interface RouteContext {
  params: Promise<{ attemptId: string }>;
}

/** Autosave: position, timers and answers. Answers of submitted modules are locked (see saveFullTestProgress). */
export const POST = withApiErrors(async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await requireApprovedSession();
  if (!session) return new UnauthorizedError("Unauthorized").toResponse();

  const { attemptId } = await params;
  const body = await req.json();
  const attempt = await prisma.fullPracticeTestAttempt.findFirst({
    where: { id: attemptId, studentId: session.user.id, status: "IN_PROGRESS" },
  });
  if (!attempt) return new NotFoundError("Not found").toResponse();

  await saveFullTestProgress(attempt, body, session.user.id);
  return NextResponse.json({ ok: true });
});
