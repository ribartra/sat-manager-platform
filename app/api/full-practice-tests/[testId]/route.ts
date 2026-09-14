import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { fullTestEditorFieldIssues } from "@/contracts/full-test";
import { validateFullPracticeTestStructure } from "@/lib/full-test-validation";

interface RouteContext {
  params: Promise<{ testId: string }>;
}

const allowedStatuses = new Set(["DRAFT", "PUBLISHED", "ARCHIVED"]);

async function validateStructureForStatus(testId: string, status: string) {
  const modules = await prisma.fullPracticeTestModule.findMany({
    where: { testId },
    include: { questions: { include: { question: { include: { topic: { include: { domain: { include: { section: true } } } } } } }, orderBy: { order: "asc" } } },
    orderBy: { order: "asc" },
  });
  const moduleQuestionIds = modules.map((testModule) => testModule.questions.map((item) => item.questionId));
  const questionSections = new Map<string, string>();
  for (const testModule of modules) {
    for (const item of testModule.questions) {
      questionSections.set(item.questionId, item.question.topic.domain.section.name === "MATH" ? "MATH" : "RW");
    }
  }
  return validateFullPracticeTestStructure({ status, moduleQuestionIds, questionSections });
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { testId } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    status?: string;
    name?: string;
    reviewEnabled?: boolean;
    breakMinutes?: number;
  };
  const test = await prisma.fullPracticeTest.findUnique({ where: { id: testId } });
  if (!test) return NextResponse.json({ error: "Exam not found." }, { status: 404 });

  const data: { status?: string; name?: string; reviewEnabled?: boolean; breakMinutes?: number } = {};
  if (body.status !== undefined) {
    if (!allowedStatuses.has(body.status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    const validation = await validateStructureForStatus(testId, body.status);
    if (validation.errors.length > 0) {
      return NextResponse.json({ error: "Validation failed.", errors: validation.errors, warnings: validation.warnings }, { status: 400 });
    }
    data.status = body.status;
  }
  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    data.name = name;
  }
  if (body.reviewEnabled !== undefined) data.reviewEnabled = Boolean(body.reviewEnabled);
  if (body.breakMinutes !== undefined) {
    if (!Number.isInteger(body.breakMinutes) || body.breakMinutes < 0) {
      return NextResponse.json({ error: "breakMinutes must be a non-negative integer." }, { status: 400 });
    }
    data.breakMinutes = body.breakMinutes;
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "No changes provided." }, { status: 400 });

  const updated = await prisma.fullPracticeTest.update({ where: { id: testId }, data });
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: data.status === "PUBLISHED" ? "PUBLISH_FULL_PRACTICE_TEST" : data.status === "ARCHIVED" ? "ARCHIVE_FULL_PRACTICE_TEST" : "UPDATE_FULL_PRACTICE_TEST",
      targetType: "FullPracticeTest",
      targetId: testId,
      metadata: JSON.stringify({ previousStatus: test.status, ...data }),
    },
  });

  return NextResponse.json({ test: updated });
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { testId } = await params;
  const { name, status, moduleQuestionIds, reviewEnabled, breakMinutes } = await req.json();
  const targetStatus = status ?? "DRAFT";
  const previous = await prisma.fullPracticeTest.findUnique({ where: { id: testId } });
  if (!previous) return NextResponse.json({ error: "Exam not found." }, { status: 404 });

  const normalizedModules = Array.from({ length: 4 }, (_, index) => (moduleQuestionIds?.[index] ?? []) as string[]);
  const questionIds = [...new Set(normalizedModules.flat())];
  const questions = await prisma.question.findMany({
    where: { id: { in: questionIds }, ...(targetStatus === "PUBLISHED" ? { status: "PUBLISHED" } : {}) },
    include: { topic: { include: { domain: { include: { section: true } } } } },
  });
  const questionSections = new Map(
    questions.map((question) => [question.id, question.topic.domain.section.name === "MATH" ? "MATH" : "RW"]),
  );
  const validation = validateFullPracticeTestStructure({ status: targetStatus, moduleQuestionIds: normalizedModules, questionSections });
  validation.errors.push(
    ...fullTestEditorFieldIssues({
      name,
      status: targetStatus,
      reviewEnabled: reviewEnabled ?? previous.reviewEnabled,
      breakMinutes:
        Number.isInteger(breakMinutes) && breakMinutes >= 0 ? breakMinutes : previous.breakMinutes,
      moduleQuestionIds: normalizedModules,
    }),
  );
  if (validation.errors.length > 0) {
    return NextResponse.json({ error: "Validation failed.", errors: [...new Set(validation.errors)], warnings: validation.warnings }, { status: 400 });
  }

  const resolvedBreak =
    Number.isInteger(breakMinutes) && breakMinutes >= 0 ? Number(breakMinutes) : previous.breakMinutes;

  const modules = await prisma.fullPracticeTestModule.findMany({ where: { testId }, orderBy: { order: "asc" } });
  await prisma.$transaction([
    ...modules.map((testModule) => prisma.fullPracticeTestQuestion.deleteMany({ where: { moduleId: testModule.id } })),
    prisma.fullPracticeTest.update({
      where: { id: testId },
      data: {
        name: name.trim(),
        status: targetStatus,
        reviewEnabled: reviewEnabled ?? previous.reviewEnabled,
        breakMinutes: resolvedBreak,
      },
    }),
    ...modules.flatMap((testModule, moduleIndex) =>
      normalizedModules[moduleIndex].map((questionId, order) =>
        prisma.fullPracticeTestQuestion.create({
          data: { moduleId: testModule.id, questionId, order, isPretest: order < 2 },
        }),
      ),
    ),
  ]);

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: previous.status !== "PUBLISHED" && targetStatus === "PUBLISHED" ? "PUBLISH_FULL_PRACTICE_TEST" : "UPDATE_FULL_PRACTICE_TEST",
      targetType: "FullPracticeTest",
      targetId: testId,
      metadata: JSON.stringify({ previousStatus: previous.status, status: targetStatus, questionCount: questionIds.length }),
    },
  });

  return NextResponse.json({ ok: true, warnings: validation.warnings });
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { testId } = await params;
  const [test, assignments, attempts] = await Promise.all([
    prisma.fullPracticeTest.findUnique({ where: { id: testId } }),
    prisma.fullPracticeTestAssignment.count({ where: { testId } }),
    prisma.fullPracticeTestAttempt.count({ where: { testId } }),
  ]);
  if (!test) return NextResponse.json({ error: "Exam not found." }, { status: 404 });
  if (assignments > 0 || attempts > 0) {
    return NextResponse.json({ error: "Archive this exam instead. Exams with assignments or attempts cannot be deleted." }, { status: 409 });
  }

  await prisma.fullPracticeTest.delete({ where: { id: testId } });
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "DELETE_FULL_PRACTICE_TEST",
      targetType: "FullPracticeTest",
      targetId: testId,
      metadata: JSON.stringify({ name: test.name, status: test.status }),
    },
  });

  return NextResponse.json({ ok: true });
}
