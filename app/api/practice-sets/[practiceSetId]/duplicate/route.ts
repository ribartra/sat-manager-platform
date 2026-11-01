import { NextResponse } from "next/server";
import { contentScopeFor } from "@/lib/program-scope";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { ForbiddenError, NotFoundError, withApiErrors } from "@/lib/api-error";

interface RouteContext {
  params: Promise<{ practiceSetId: string }>;
}

export const POST = withApiErrors(async function POST(_req: Request, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return new ForbiddenError("Forbidden").toResponse();

  const { practiceSetId } = await params;
  const practiceSet = await prisma.practiceSet.findFirst({
    where: { id: practiceSetId, ...contentScopeFor(session.user) },
    include: { questions: { orderBy: { order: "asc" } } },
  });
  if (!practiceSet) return new NotFoundError("Practice Set not found.").toResponse();

  const copy = await prisma.practiceSet.create({
    data: {
      // The copy stays in the same program's bank.
      programId: practiceSet.programId,
      sourceId: practiceSet.sourceId,
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
});
