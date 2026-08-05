import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { validatePracticeSetPayload } from "@/lib/content-validation";

interface RouteContext {
  params: Promise<{ practiceSetId: string }>;
}

const allowedStatuses = new Set(["DRAFT", "PUBLISHED", "BLOCKED", "ARCHIVED"]);

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { practiceSetId } = await params;
  const body = (await req.json().catch(() => ({}))) as { status?: string };
  if (!body.status || !allowedStatuses.has(body.status)) {
    return NextResponse.json({ error: "Invalid Practice Set status." }, { status: 400 });
  }

  const practiceSet = await prisma.practiceSet.findUnique({
    where: { id: practiceSetId },
    include: { questions: { include: { question: { select: { id: true, status: true, topicId: true } } } } },
  });
  if (!practiceSet) return NextResponse.json({ error: "Practice Set not found." }, { status: 404 });

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
    return NextResponse.json({ error: "Validation failed.", errors: validationErrors }, { status: 400 });
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

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { practiceSetId } = await params;
  const [practiceSet, assignments, groupAssignments, attempts] = await Promise.all([
    prisma.practiceSet.findUnique({ where: { id: practiceSetId } }),
    prisma.assignment.count({ where: { practiceSetId } }),
    prisma.groupAssignment.count({ where: { practiceSetId } }),
    prisma.attempt.count({ where: { practiceSetId } }),
  ]);
  if (!practiceSet) return NextResponse.json({ error: "Practice Set not found." }, { status: 404 });
  if (assignments > 0 || groupAssignments > 0 || attempts > 0) {
    return NextResponse.json({ error: "Archive this Practice Set instead. Sets with assignments or attempts cannot be deleted." }, { status: 409 });
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
}
