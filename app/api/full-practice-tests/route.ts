import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { fullTestEditorFieldIssues } from "@/contracts/full-test";
import { validateFullPracticeTestStructure } from "@/lib/full-test-validation";
import { FULL_TEST_MODULES } from "@/lib/full-test-modules";
import { ForbiddenError, ValidationError, withApiErrors } from "@/lib/api-error";
import { writeAudit } from "@/lib/audit";
import { contentProgramFor, sameProgramQuestionsIssue } from "@/lib/program-scope";
import { sourceIdIssue } from "@/lib/content-source";

export const POST = withApiErrors(async function POST(req: NextRequest) {
  const session = await requireTeacherOrAdmin();
  if (!session) return new ForbiddenError("Forbidden").toResponse();

  const { name, status, moduleQuestionIds, reviewEnabled, breakMinutes, sourceId, programId: requestedProgramId } = await req.json();
  // The Test goes to the bank of a program the author teaches, with questions of that same bank.
  const programId = await contentProgramFor(session.user, typeof requestedProgramId === "string" ? requestedProgramId : null);
  const targetStatus = status ?? "DRAFT";
  const normalizedModules = Array.from({ length: 4 }, (_, index) => (moduleQuestionIds?.[index] ?? []) as string[]);
  const questionIds = [...new Set(normalizedModules.flat())];
  const questions = await prisma.question.findMany({
    where: { id: { in: questionIds }, ...(targetStatus === "PUBLISHED" ? { status: "PUBLISHED" } : {}) },
    include: { topic: { include: { domain: { include: { section: true } } } } },
  });
  const questionSections = new Map(
    questions.map((question) => [
      question.id,
      question.topic.domain.section.name === "MATH" ? "MATH" : "RW",
    ])
  );
  const validation = validateFullPracticeTestStructure({
    status: targetStatus,
    moduleQuestionIds: normalizedModules,
    questionSections,
  });
  validation.errors.push(
    ...fullTestEditorFieldIssues({
      name,
      status: targetStatus,
      reviewEnabled: reviewEnabled ?? true,
      breakMinutes: Number.isInteger(breakMinutes) && breakMinutes >= 0 ? breakMinutes : 0,
      moduleQuestionIds: normalizedModules,
    }),
  );
  const programIssue = await sameProgramQuestionsIssue(questionIds, programId);
  if (programIssue) validation.errors.push(programIssue);
  const sourceIssue = await sourceIdIssue(sourceId, "tests");
  if (sourceIssue) validation.errors.push(sourceIssue);
  if (validation.errors.length > 0) {
    return new ValidationError("Validation failed.", [...new Set(validation.errors)], { extra: { warnings: validation.warnings } }).toResponse();
  }

  const resolvedBreak =
    Number.isInteger(breakMinutes) && breakMinutes >= 0 ? Number(breakMinutes) : 0;

  const test = await prisma.fullPracticeTest.create({
    data: {
      programId,
      sourceId,
      name,
      status: status ?? "DRAFT",
      reviewEnabled: reviewEnabled ?? true,
      breakMinutes: resolvedBreak,
      modules: {
        create: FULL_TEST_MODULES.map((module, order) => ({
          name: module.name,
          section: module.section,
          timeLimit: module.timeLimit,
          order,
          questions: {
            create: normalizedModules[order].map((questionId, qOrder) => ({
              questionId,
              order: qOrder,
              isPretest: qOrder < 2,
            })),
          },
        })),
      },
    },
  });

  await writeAudit({
    userId: session.user.id,
    action: "CREATE_FULL_PRACTICE_TEST",
    targetType: "FullPracticeTest",
    targetId: test.id,
    metadata: { name, status: test.status, questionCount: normalizedModules.flat().length },
  });

  return NextResponse.json({ test, warnings: validation.warnings });
});
