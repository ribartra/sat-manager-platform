import { NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ testId: string }>;
}

export async function POST(_req: Request, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { testId } = await params;
  const test = await prisma.fullPracticeTest.findUnique({
    where: { id: testId },
    include: { modules: { include: { questions: { orderBy: { order: "asc" } } }, orderBy: { order: "asc" } } },
  });
  if (!test) return NextResponse.json({ error: "Exam not found." }, { status: 404 });

  const copy = await prisma.fullPracticeTest.create({
    data: {
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
}
