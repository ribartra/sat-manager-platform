import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApprovedSession } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

interface RouteContext {
  params: Promise<{ attemptId: string }>;
}

export async function POST(_req: Request, { params }: RouteContext) {
  const session = await requireApprovedSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { attemptId } = await params;
  const attempt = await prisma.fullPracticeTestAttempt.findFirst({
    where: { id: attemptId, studentId: session.user.id, status: "IN_PROGRESS" },
    select: { id: true },
  });
  if (!attempt) return NextResponse.json({ error: "Attempt not found." }, { status: 404 });

  const pause = await prisma.fullPracticeTestPause.findFirst({
    where: { attemptId, resumedAt: null },
    orderBy: { pausedAt: "desc" },
  });
  if (!pause) return NextResponse.json({ ok: true, resumed: false });

  const resumedAt = new Date();
  const durationSeconds = Math.max(0, Math.round((resumedAt.getTime() - pause.pausedAt.getTime()) / 1000));
  const updated = await prisma.fullPracticeTestPause.update({
    where: { id: pause.id },
    data: { resumedAt, durationSeconds },
  });
  await writeAudit({
    userId: session.user.id,
    action: "FPT_ATTEMPT_RESUMED",
    targetType: "FullPracticeTestAttempt",
    targetId: attemptId,
    outcome: "info",
    metadata: { durationSeconds },
  });
  return NextResponse.json({ ok: true, resumed: true, pause: updated });
}
