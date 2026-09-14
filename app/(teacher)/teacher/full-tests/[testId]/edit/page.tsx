import { PageShell } from "@/components/sat";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { FullTestEditor } from "../../new/full-test-editor-client";
import { findQuestionsWithOptionMediaAndSection } from "@/lib/question-list-media-query";

interface PageProps {
  params: Promise<{ testId: string }>;
}

export default async function EditFullTestPage({ params }: PageProps) {
  const { testId } = await params;
  const [test, questions] = await Promise.all([
    prisma.fullPracticeTest.findUnique({
      where: { id: testId },
      include: { modules: { include: { questions: { orderBy: { order: "asc" } } }, orderBy: { order: "asc" } } },
    }),
    findQuestionsWithOptionMediaAndSection({ status: { in: ["PUBLISHED", "DRAFT"] } }),
  ]);
  if (!test) notFound();

  return (
    <PageShell>
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
        questions={questions}
      />
    </PageShell>
  );
}
