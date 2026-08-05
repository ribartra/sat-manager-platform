import { NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ questionId: string }>;
}

export async function POST(_req: Request, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { questionId } = await params;
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { options: { orderBy: { label: "asc" } } },
  });
  if (!question) return NextResponse.json({ error: "Question not found." }, { status: 404 });

  const copy = await prisma.question.create({
    data: {
      stem: question.stem,
      stimulus: question.stimulus,
      type: question.type,
      difficulty: question.difficulty,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      topicId: question.topicId,
      subskillId: question.subskillId,
      status: "DRAFT",
      imageUrl: question.imageUrl,
      supportsGraph: question.supportsGraph,
      options: question.type === "MC"
        ? {
            create: question.options.map((option) => ({
              label: option.label,
              text: option.text,
              imageUrl: option.imageUrl,
            })),
          }
        : undefined,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "DUPLICATE_QUESTION",
      targetType: "Question",
      targetId: copy.id,
      metadata: JSON.stringify({ sourceQuestionId: questionId }),
    },
  });

  return NextResponse.json({ question: copy });
}
