import { NextRequest, NextResponse } from "next/server";
import { contentScopeFor } from "@/lib/program-scope";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { questionEditorIssues } from "@/contracts/question";
import { validateQuestionPayload } from "@/lib/content-validation";
import { materializeOfficialImageUrl } from "@/lib/ingest-promotion";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, ValidationError, withApiErrors } from "@/lib/api-error";

interface RouteContext {
  params: Promise<{ questionId: string }>;
}

const allowedStatuses = new Set(["DRAFT", "PUBLISHED", "ARCHIVED"]);

export const PATCH = withApiErrors(async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return new ForbiddenError("Forbidden").toResponse();
  }

  const { questionId } = await params;
  const body = (await req.json().catch(() => ({}))) as { status?: string };
  if (!body.status || !allowedStatuses.has(body.status)) {
    return new BadRequestError("Invalid question status.").toResponse();
  }

  // Only questions of a program the teacher teaches (shared bank).
  const question = await prisma.question.findFirst({
    where: { id: questionId, ...contentScopeFor(session.user) },
    include: { options: true },
  });
  if (!question) return new NotFoundError("Question not found.").toResponse();

  const validationErrors = validateQuestionPayload({
    topicId: question.topicId,
    difficulty: question.difficulty,
    type: question.type,
    stem: question.stem,
    explanation: question.explanation,
    correctAnswer: question.correctAnswer,
    status: body.status,
    options: question.options,
  });
  if (validationErrors.length > 0) {
    return new ValidationError("Validation failed.", validationErrors).toResponse();
  }

  const updated = await prisma.question.update({
    where: { id: questionId },
    data: { status: body.status },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: body.status === "PUBLISHED" ? "PUBLISH_QUESTION" : body.status === "ARCHIVED" ? "ARCHIVE_QUESTION" : "DRAFT_QUESTION",
      targetType: "Question",
      targetId: questionId,
      metadata: JSON.stringify({ previousStatus: question.status, status: body.status }),
    },
  });

  return NextResponse.json(updated);
});

export const PUT = withApiErrors(async function PUT(req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return new ForbiddenError("Forbidden").toResponse();
  }

  const { questionId } = await params;
  const { topicId, subskillId, difficulty, type, stem, stimulus, explanation, imageUrl, supportsGraph, correctAnswer, status, options } = await req.json();
  const previous = await prisma.question.findFirst({
    where: { id: questionId, ...contentScopeFor(session.user) },
    select: { status: true, topicId: true, difficulty: true, type: true },
  });
  if (!previous) return new NotFoundError("Question not found.").toResponse();
  const validationErrors = questionEditorIssues({
    topicId,
    difficulty,
    type,
    stem,
    explanation,
    imageUrl,
    correctAnswer,
    status,
    options,
  });
  if (validationErrors.length > 0) {
    return new ValidationError("Validation failed.", validationErrors).toResponse();
  }
  const officialImageUrl = await materializeOfficialImageUrl(imageUrl);
  const officialOptions = type === "MC"
    ? await Promise.all(
        options.map(async (o: { label: string; text: string; imageUrl?: string | null }) => ({
          ...o,
          imageUrl: await materializeOfficialImageUrl(o.imageUrl),
        }))
      )
    : options;

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
      imageUrl: officialImageUrl || null,
      supportsGraph: Boolean(supportsGraph),
      correctAnswer,
      status,
      options:
        type === "MC"
          ? {
              create: officialOptions
                .filter((o: { text?: string; imageUrl?: string | null }) =>
                  Boolean(o.text?.trim() || o.imageUrl?.trim()),
                )
                .map((o: { label: string; text?: string; imageUrl?: string | null }) => ({
                  label: o.label,
                  text: o.text ?? "",
                  imageUrl: o.imageUrl || null,
                })),
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
});

export const DELETE = withApiErrors(async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return new ForbiddenError("Forbidden").toResponse();
  }

  const { questionId } = await params;
  const [question, practiceSetLinks, fullTestLinks, attemptAnswers] = await Promise.all([
    prisma.question.findFirst({ where: { id: questionId, ...contentScopeFor(session.user) } }),
    prisma.practiceSetQuestion.count({ where: { questionId } }),
    prisma.fullPracticeTestQuestion.count({ where: { questionId } }),
    prisma.attemptAnswer.count({ where: { questionId } }),
  ]);
  if (!question) return new NotFoundError("Question not found.").toResponse();
  if (practiceSetLinks > 0 || fullTestLinks > 0 || attemptAnswers > 0) {
    return new ConflictError("Archive this question instead. Questions with usage cannot be deleted.").toResponse();
  }

  await prisma.question.delete({ where: { id: questionId } });
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "DELETE_QUESTION",
      targetType: "Question",
      targetId: questionId,
      metadata: JSON.stringify({ previousStatus: question.status }),
    },
  });

  return NextResponse.json({ ok: true });
});
