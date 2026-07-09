import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { validateQuestionPayload } from "@/lib/content-validation";

interface RouteContext {
  params: Promise<{ questionId: string }>;
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { questionId } = await params;
  const { topicId, subskillId, difficulty, type, stem, stimulus, explanation, imageUrl, supportsGraph, correctAnswer, status, options } = await req.json();
  const previous = await prisma.question.findUnique({
    where: { id: questionId },
    select: { status: true, topicId: true, difficulty: true, type: true },
  });
  const validationErrors = validateQuestionPayload({ topicId, difficulty, type, stem, explanation, correctAnswer, status, options });
  if (validationErrors.length > 0) {
    return NextResponse.json({ error: "Validation failed.", errors: validationErrors }, { status: 400 });
  }

  await prisma.questionOption.deleteMany({ where: { questionId } });

  const question = await prisma.question.update({
    where: { id: questionId },
    data: {
      topicId,
      subskillId: subskillId || null,
      difficulty,
      type,
      stem,
      stimulus: stimulus || null,
      explanation: explanation || null,
      imageUrl: imageUrl || null,
      supportsGraph: Boolean(supportsGraph),
      correctAnswer,
      status,
      options:
        type === "MC"
          ? {
              create: options
                .filter((o: { text: string }) => o.text)
                .map((o: { label: string; text: string }) => ({ label: o.label, text: o.text })),
            }
          : undefined,
    },
  });

  const auditAction =
    previous?.status !== "PUBLISHED" && status === "PUBLISHED"
      ? "PUBLISH_QUESTION"
      : status === "ARCHIVED"
      ? "ARCHIVE_QUESTION"
      : "UPDATE_QUESTION";
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: auditAction,
      targetType: "Question",
      targetId: question.id,
      metadata: JSON.stringify({
        previousStatus: previous?.status ?? null,
        status,
        previousTopicId: previous?.topicId ?? null,
        topicId,
        difficulty,
        type,
        supportsGraph: Boolean(supportsGraph),
      }),
    },
  });

  return NextResponse.json(question);
}
