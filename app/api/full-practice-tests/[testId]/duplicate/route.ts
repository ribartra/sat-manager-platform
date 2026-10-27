import { NextResponse } from "next/server";
import { contentScopeFor } from "@/lib/program-scope";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { ForbiddenError, NotFoundError, withApiErrors } from "@/lib/api-error";

interface RouteContext {
  params: Promise<{ testId: string }>;
}

export const POST = withApiErrors(async function POST(_req: Request, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return new ForbiddenError("Forbidden").toResponse();

  const { testId } = await params;
  const test = await prisma.fullPracticeTest.findFirst({
    where: { id: testId, ...contentScopeFor(session.user) },
    include: { modules: { include: { questions: { orderBy: { order: "asc" } } }, orderBy: { order: "asc" } } },
  });
  if (!test) return new NotFoundError("Test not found.").toResponse();

  const copy = await prisma.fullPracticeTest.create({
    data: {
      // The copy stays in the same program's bank.
      programId: test.programId,
      name: `${test.name} Copy`,
      status: "DRAFT",
      reviewEnabled: test.reviewEnabled,
      breakMinutes: test.breakMinutes,
      modules: {
        create: test.modules.map((module) => ({
          name: module.name,
          section: module.section,
          order: module.order,
          timeLimit: module.timeLimit,
          questions: {
            create: module.questions.map((item) => ({
              questionId: item.questionId,
              order: item.order,
              isPretest: item.isPretest || item.order < 2,
            })),
          },
        })),
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "DUPLICATE_FULL_PRACTICE_TEST",
      targetType: "FullPracticeTest",
      targetId: copy.id,
      metadata: JSON.stringify({ sourceTestId: test.id, sourceName: test.name }),
    },
  });

  return NextResponse.json({ test: copy });
});
