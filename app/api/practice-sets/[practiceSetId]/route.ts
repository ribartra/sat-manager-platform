import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ practiceSetId: string }>;
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { practiceSetId } = await params;
  const { name, topicId, difficulty, status, explanationVisibility, questionIds } = await req.json();

  await prisma.$transaction([
    prisma.practiceSetQuestion.deleteMany({ where: { practiceSetId } }),
    prisma.practiceSet.update({
      where: { id: practiceSetId },
      data: { name, topicId, difficulty, status, explanationVisibility },
    }),
    ...((questionIds as string[]).map((questionId, order) =>
      prisma.practiceSetQuestion.create({ data: { practiceSetId, questionId, order } })
    )),
  ]);

  return NextResponse.json({ ok: true });
}
