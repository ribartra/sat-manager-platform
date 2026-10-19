import { Breadcrumbs } from "@/components/sat/breadcrumbs";
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
      <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "Tests", href: "/teacher/tests" }, { label: test.name, href: `/teacher/tests/${test.id}` }, { label: "Edit" }]} />
      <h1 className="mb-6 text-[26px] font-bold tracking-[-0.3px] text-gray-900">Edit test</h1>
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
