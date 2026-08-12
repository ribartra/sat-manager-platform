import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { FullTestEditor } from "../../new/full-test-editor-client";

interface PageProps {
  params: Promise<{ testId: string }>;
}

function plainMathLabel(content: string, maxLength: number) {
  const label = content
    .replace(/\$\$([\s\S]+?)\$\$/g, "$1")
    .replace(/\\\[([\s\S]+?)\\\]/g, "$1")
    .replace(/\$([^$\n]+?)\$/g, "$1")
    .replace(/\\\(([\s\S]+?)\\\)/g, "$1");
  return label.length > maxLength ? `${label.slice(0, maxLength)}...` : label;
}

export default async function EditFullTestPage({ params }: PageProps) {
  const { testId } = await params;
  const [test, questions] = await Promise.all([
    prisma.fullPracticeTest.findUnique({
      where: { id: testId },
      include: { modules: { include: { questions: { orderBy: { order: "asc" } } }, orderBy: { order: "asc" } } },
    }),
    prisma.question.findMany({
      where: { status: { in: ["PUBLISHED", "DRAFT"] } },
      include: { topic: { include: { domain: { include: { section: true } } } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  if (!test) notFound();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Edit Exam</h1>
      <FullTestEditor
        initial={{
          id: test.id,
          name: test.name,
          status: test.status,
          reviewEnabled: test.reviewEnabled,
          breakMinutes: test.breakMinutes,
          moduleQuestionIds: test.modules.map((module) => module.questions.map((item) => item.questionId)),
        }}
        questions={questions.map((q) => ({
          id: q.id,
          label: `${q.topic.domain.section.name === "MATH" ? "MATH" : "RW"} · ${q.difficulty} · ${plainMathLabel(q.stem, 100)}`,
          stem: q.stem,
          difficulty: q.difficulty,
          section: q.topic.domain.section.name === "MATH" ? "MATH" : "RW",
        }))}
      />
    </div>
  );
}
