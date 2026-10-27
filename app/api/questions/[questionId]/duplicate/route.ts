import { NextResponse } from "next/server";
import { contentScopeFor } from "@/lib/program-scope";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { ForbiddenError, NotFoundError, withApiErrors } from "@/lib/api-error";

interface RouteContext {
  params: Promise<{ questionId: string }>;
}

export const POST = withApiErrors(async function POST(_req: Request, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return new ForbiddenError("Forbidden").toResponse();

  const { questionId } = await params;
  const question = await prisma.question.findFirst({
    where: { id: questionId, ...contentScopeFor(session.user) },
    include: { options: { orderBy: { label: "asc" } } },
  });
  if (!question) return new NotFoundError("Question not found.").toResponse();

  const copy = await prisma.question.create({
    data: {
      // The copy stays in the same program's bank.
      programId: question.programId,
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
});
