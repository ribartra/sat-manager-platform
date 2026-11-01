import { NextRequest, NextResponse } from "next/server";
import { contentScopeFor, sameProgramQuestionsIssue } from "@/lib/program-scope";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma, { atomic } from "@/lib/prisma";
import { assertSameVersion, expectedVersion } from "@/lib/edit-version";
import { practiceSetEditorIssues } from "@/contracts/practice-set";
import { sourceIdIssue } from "@/lib/content-source";
import { validatePracticeSetPayload } from "@/lib/content-validation";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, ValidationError, withApiErrors } from "@/lib/api-error";

interface RouteContext {
  params: Promise<{ practiceSetId: string }>;
}

const allowedStatuses = new Set(["DRAFT", "PUBLISHED", "BLOCKED", "ARCHIVED"]);

export const PATCH = withApiErrors(async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return new ForbiddenError("Forbidden").toResponse();
  }

  const { practiceSetId } = await params;
  const body = (await req.json().catch(() => ({}))) as { status?: string };
  if (!body.status || !allowedStatuses.has(body.status)) {
    return new BadRequestError("Invalid Practice Set status.").toResponse();
  }

  // Only sets of a program the teacher teaches (shared bank).
  const practiceSet = await prisma.practiceSet.findFirst({
    where: { id: practiceSetId, ...contentScopeFor(session.user) },
    include: { questions: { include: { question: { select: { id: true, status: true, topicId: true } } } } },
  });
  if (!practiceSet) return new NotFoundError("Practice Set not found.").toResponse();

  const questionIds = practiceSet.questions.map((item) => item.questionId);
  const validationErrors = validatePracticeSetPayload({
    name: practiceSet.name,
    topicId: practiceSet.topicId,
    difficulty: practiceSet.difficulty,
    status: body.status,
    explanationVisibility: practiceSet.explanationVisibility,
    questionIds,
  });
  if (body.status === "PUBLISHED") {
    if (practiceSet.questions.some((item) => item.question.status !== "PUBLISHED")) validationErrors.push("All questions must be published before publishing a Practice Set.");
    if (practiceSet.questions.some((item) => item.question.topicId !== practiceSet.topicId)) validationErrors.push("All questions in a Practice Set must belong to the selected topic.");
  }
  if (validationErrors.length > 0) {
    return new ValidationError("Validation failed.", validationErrors).toResponse();
  }

  const updated = await prisma.practiceSet.update({
    where: { id: practiceSetId },
    data: { status: body.status },
  });
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: body.status === "PUBLISHED" ? "PUBLISH_PRACTICE_SET" : body.status === "ARCHIVED" ? "ARCHIVE_PRACTICE_SET" : body.status === "BLOCKED" ? "BLOCK_PRACTICE_SET" : "DRAFT_PRACTICE_SET",
      targetType: "PracticeSet",
      targetId: practiceSetId,
      metadata: JSON.stringify({ previousStatus: practiceSet.status, status: body.status }),
    },
  });

  return NextResponse.json(updated);
});

export const PUT = withApiErrors(async function PUT(req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return new ForbiddenError("Forbidden").toResponse();
  }

  const { practiceSetId } = await params;
  const { name, topicId, difficulty, status, explanationVisibility, questionIds, sourceId: requestedSourceId, expectedUpdatedAt } = await req.json();
  const previous = await prisma.practiceSet.findFirst({
    where: { id: practiceSetId, ...contentScopeFor(session.user) },
    select: { status: true, topicId: true, difficulty: true, programId: true, sourceId: true },
  });
  if (!previous) return new NotFoundError("Practice Set not found.").toResponse();
  const sourceId = requestedSourceId ?? previous.sourceId;
  const validationErrors = practiceSetEditorIssues({ name, topicId, difficulty, status, explanationVisibility, questionIds });
  const sourceIssue = await sourceIdIssue(sourceId, "practice", previous.sourceId);
  if (sourceIssue) validationErrors.push(sourceIssue);
  const programIssue = await sameProgramQuestionsIssue(Array.isArray(questionIds) ? questionIds : [], previous.programId);
  if (programIssue) validationErrors.push(programIssue);
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
    return new ValidationError("Validation failed.", validationErrors).toResponse();
  }

  // One transaction; refused (409) when someone else saved this set since the editor loaded it.
  const saved = await atomic(async (db) => {
    const current = await db.practiceSet.findUniqueOrThrow({ where: { id: practiceSetId }, select: { updatedAt: true } });
    assertSameVersion(current.updatedAt, expectedVersion(expectedUpdatedAt));
    await db.practiceSetQuestion.deleteMany({ where: { practiceSetId } });
    const updated = await db.practiceSet.update({
      where: { id: practiceSetId },
      data: { name, topicId, difficulty, status, explanationVisibility, sourceId },
      select: { updatedAt: true },
    });
    await db.practiceSetQuestion.createMany({
      data: (questionIds as string[]).map((questionId, order) => ({ practiceSetId, questionId, order })),
    });
    return updated;
  });

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
        sourceId,
        difficulty,
        explanationVisibility,
        questionCount: Array.isArray(questionIds) ? questionIds.length : 0,
      }),
    },
  });

  return NextResponse.json({ ok: true, updatedAt: saved.updatedAt.toISOString() });
});

export const DELETE = withApiErrors(async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return new ForbiddenError("Forbidden").toResponse();
  }

  const { practiceSetId } = await params;
  const [practiceSet, assignments, groupAssignments, attempts] = await Promise.all([
    prisma.practiceSet.findFirst({ where: { id: practiceSetId, ...contentScopeFor(session.user) } }),
    prisma.assignment.count({ where: { practiceSetId } }),
    prisma.groupAssignment.count({ where: { practiceSetId } }),
    prisma.attempt.count({ where: { practiceSetId } }),
  ]);
  if (!practiceSet) return new NotFoundError("Practice Set not found.").toResponse();
  if (assignments > 0 || groupAssignments > 0 || attempts > 0) {
    return new ConflictError("Archive this Practice Set instead. Sets with assignments or attempts cannot be deleted.").toResponse();
  }

  await prisma.practiceSet.delete({ where: { id: practiceSetId } });
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "DELETE_PRACTICE_SET",
      targetType: "PracticeSet",
      targetId: practiceSetId,
      metadata: JSON.stringify({ previousStatus: practiceSet.status }),
    },
  });

  return NextResponse.json({ ok: true });
});
