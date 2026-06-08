import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ attemptId: string }>;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { attemptId } = await params;
  const { comment } = await req.json();
  const teacherComment = typeof comment === "string" ? comment.trim() : "";

  await prisma.attempt.update({
    where: { id: attemptId },
    data: { teacherComment: teacherComment || null },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "COMMENT_ATTEMPT",
      targetType: "Attempt",
      targetId: attemptId,
      metadata: JSON.stringify({ hasComment: Boolean(teacherComment) }),
    },
  });

  return NextResponse.json({ ok: true });
}
