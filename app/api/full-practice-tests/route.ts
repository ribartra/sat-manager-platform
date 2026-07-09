import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { validateFullPracticeTestStructure } from "@/lib/full-test-validation";

const MODULES = [
  { name: "Reading & Writing Module 1", section: "RW", timeLimit: 32 * 60 },
  { name: "Reading & Writing Module 2", section: "RW", timeLimit: 32 * 60 },
  { name: "Math Module 1", section: "MATH", timeLimit: 35 * 60 },
  { name: "Math Module 2", section: "MATH", timeLimit: 35 * 60 },
];

export async function POST(req: NextRequest) {
  const session = await requireTeacherOrAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, status, moduleQuestionIds } = await req.json();
  const normalizedModules = Array.from({ length: 4 }, (_, index) => (moduleQuestionIds?.[index] ?? []) as string[]);
  const questionIds = [...new Set(normalizedModules.flat())];
  const questions = await prisma.question.findMany({
    where: { id: { in: questionIds }, status: "PUBLISHED" },
    include: { topic: { include: { domain: { include: { section: true } } } } },
  });
  const questionSections = new Map(
    questions.map((question) => [
      question.id,
      question.topic.domain.section.name === "MATH" ? "MATH" : "RW",
    ])
  );
  const validation = validateFullPracticeTestStructure({
    status: status ?? "DRAFT",
    moduleQuestionIds: normalizedModules,
    questionSections,
  });
  if (validation.errors.length > 0) {
    return NextResponse.json({ error: "Validation failed.", errors: validation.errors, warnings: validation.warnings }, { status: 400 });
  }

  const test = await prisma.fullPracticeTest.create({
    data: {
      name,
      status: status ?? "DRAFT",
      modules: {
        create: MODULES.map((module, order) => ({
          ...module,
          order,
          questions: {
            create: normalizedModules[order].map((questionId, qOrder) => ({ questionId, order: qOrder })),
          },
        })),
      },
    },
  });

  return NextResponse.json({ test, warnings: validation.warnings });
}
