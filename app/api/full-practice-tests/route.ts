import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { validateFullPracticeTestStructure } from "@/lib/full-test-validation";
import { FULL_TEST_MODULES } from "@/lib/full-test-modules";

export async function POST(req: NextRequest) {
  const session = await requireTeacherOrAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, status, moduleQuestionIds, reviewEnabled, breakMinutes } = await req.json();
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
  if (validation.errors.length > 0) {
    return NextResponse.json({ error: "Validation failed.", errors: validation.errors, warnings: validation.warnings }, { status: 400 });
  }

  const resolvedBreak =
    Number.isInteger(breakMinutes) && breakMinutes >= 0 ? Number(breakMinutes) : 10;

  const test = await prisma.fullPracticeTest.create({
    data: {
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

  return NextResponse.json({ test, warnings: validation.warnings });
}
