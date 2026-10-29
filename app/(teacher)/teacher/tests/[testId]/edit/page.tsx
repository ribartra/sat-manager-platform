import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { currentContentScope } from "@/lib/content-scope";
import { PageShell } from "@/components/sat";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { FullTestEditor } from "../../new/full-test-editor-client";
import { findQuestionsWithOptionMediaAndSection } from "@/lib/question-list-media-query";
import { listSources } from "@/lib/content-source";

interface PageProps {
  params: Promise<{ testId: string }>;
}

export default async function EditFullTestPage({ params }: PageProps) {
  const { testId } = await params;
  // The bank of the programs the teacher teaches (shared by the program's teachers).
  const scope = await currentContentScope();
  const [test, questions, sources] = await Promise.all([
    prisma.fullPracticeTest.findFirst({
      where: { id: testId, ...scope },
      include: { modules: { include: { questions: { orderBy: { order: "asc" } } }, orderBy: { order: "asc" } } },
    }),
    findQuestionsWithOptionMediaAndSection({ status: { in: ["PUBLISHED", "DRAFT"] }, ...scope }),
    listSources(),
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
          sourceId: test.sourceId,
          moduleQuestionIds: test.modules.map((module) => module.questions.map((item) => item.questionId)),
        }}
        questions={questions}
        sources={sources.filter((s) => s.id === test.sourceId || (s.active && s.forTests))}
      />
    </PageShell>
  );
}
