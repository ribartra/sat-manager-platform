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
  const attempt = await prisma.attempt.findFirst({
    where: { id: attemptId, studentId: session.user.id, status: "IN_PROGRESS" },
    select: { id: true },
  });
  if (!attempt) return NextResponse.json({ error: "Attempt not found." }, { status: 404 });

  const existing = await prisma.attemptPause.findFirst({
    where: { attemptId, resumedAt: null },
    orderBy: { pausedAt: "desc" },
  });
  if (existing) return NextResponse.json(existing);

  const pause = await prisma.attemptPause.create({ data: { attemptId } });
  await writeAudit({
    userId: session.user.id,
    action: "ATTEMPT_PAUSED",
    targetType: "Attempt",
    targetId: attemptId,
    outcome: "info",
  });
  return NextResponse.json(pause);
}
