import { NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ practiceSetId: string }>;
}

export async function POST(_req: Request, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { practiceSetId } = await params;
  const practiceSet = await prisma.practiceSet.findUnique({
    where: { id: practiceSetId },
    include: { questions: { orderBy: { order: "asc" } } },
  });
  if (!practiceSet) return NextResponse.json({ error: "Practice Set not found." }, { status: 404 });

  const copy = await prisma.practiceSet.create({
    data: {
      name: `${practiceSet.name} Copy`,
      topicId: practiceSet.topicId,
      difficulty: practiceSet.difficulty,
      status: "DRAFT",
      explanationVisibility: practiceSet.explanationVisibility,
      questions: {
        create: practiceSet.questions.map((item) => ({
          questionId: item.questionId,
          order: item.order,
        })),
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "DUPLICATE_PRACTICE_SET",
      targetType: "PracticeSet",
      targetId: copy.id,
      metadata: JSON.stringify({ sourcePracticeSetId: practiceSetId }),
    },
  });

  return NextResponse.json({ practiceSet: copy });
}
