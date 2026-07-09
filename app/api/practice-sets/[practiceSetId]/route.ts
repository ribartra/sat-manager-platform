import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { validatePracticeSetPayload } from "@/lib/content-validation";

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
  const previous = await prisma.practiceSet.findUnique({
    where: { id: practiceSetId },
    select: { status: true, topicId: true, difficulty: true },
  });
  const validationErrors = validatePracticeSetPayload({ name, topicId, difficulty, status, explanationVisibility, questionIds });
  if ((status || "DRAFT") === "PUBLISHED" && Array.isArray(questionIds) && questionIds.length > 0) {
    const questions = await prisma.question.findMany({
      where: { id: { in: questionIds } },
      select: { id: true, status: true, topicId: true },
    });
    if (questions.length !== questionIds.length) validationErrors.push("All selected questions must exist.");
    if (questions.some((question) => question.status !== "PUBLISHED")) {
      validationErrors.push("All questions must be published before publishing a Practice Set.");
    }
    if (questions.some((question) => question.topicId !== topicId)) {
      validationErrors.push("All questions in a Practice Set must belong to the selected topic.");
    }
  }
  if (validationErrors.length > 0) {
    return NextResponse.json({ error: "Validation failed.", errors: validationErrors }, { status: 400 });
  }

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

  const auditAction =
    previous?.status !== "PUBLISHED" && status === "PUBLISHED"
      ? "PUBLISH_PRACTICE_SET"
      : status === "ARCHIVED"
      ? "ARCHIVE_PRACTICE_SET"
      : "UPDATE_PRACTICE_SET";
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: auditAction,
      targetType: "PracticeSet",
      targetId: practiceSetId,
      metadata: JSON.stringify({
        previousStatus: previous?.status ?? null,
        status,
        previousTopicId: previous?.topicId ?? null,
        topicId,
        difficulty,
        explanationVisibility,
        questionCount: Array.isArray(questionIds) ? questionIds.length : 0,
      }),
    },
  });

  return NextResponse.json({ ok: true });
}
