import { PageShell } from "@/components/sat";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { QuestionEditor } from "../../question-editor-client";
import { getFeatureSetting } from "@/lib/app-settings";
import { academicTopicWhere, buildTaxonomyTree, taxonomyPathLabel } from "@/lib/taxonomy";

interface PageProps {
  params: Promise<{ questionId: string }>;
}

export default async function EditQuestionPage({ params }: PageProps) {
  const { questionId } = await params;

  const [question, topics, taxonomyNodes, showGraphOption] = await Promise.all([
    prisma.question.findUnique({
      where: { id: questionId },
      include: { options: { orderBy: { label: "asc" } } },
    }),
    prisma.topic.findMany({
      where: academicTopicWhere,
      include: { taxonomyNode: true, domain: { include: { section: true } }, subskills: true },
      orderBy: { name: "asc" },
    }),
    prisma.taxonomyNode.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] }),
    getFeatureSetting("QUESTION_GRAPH_VISUALIZATION"),
  ]);
  const { byId } = buildTaxonomyTree(taxonomyNodes);

  if (!question) notFound();

  return (
    <PageShell width="narrow">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Edit Question</h1>
      <QuestionEditor
        showGraphOption={showGraphOption}
        initial={{
          id: question.id,
          topicId: question.topicId,
          subskillId: question.subskillId,
          difficulty: question.difficulty,
          type: question.type,
          stem: question.stem,
          stimulus: question.stimulus ?? "",
          explanation: question.explanation ?? "",
          imageUrl: question.imageUrl ?? "",
          supportsGraph: question.supportsGraph,
          correctAnswer: question.correctAnswer,
          status: question.status,
          options: question.options.map((o) => ({ label: o.label, text: o.text, imageUrl: o.imageUrl })),
        }}
        topics={topics.map((t) => ({
          id: t.id,
          name: t.name,
          sectionLabel: t.domain.section.label,
          domainName: t.domain.name,
          taxonomyLabel: taxonomyPathLabel(t.taxonomyNodeId, byId, `${t.domain.section.label} / ${t.domain.name} / ${t.name}`),
          subskills: t.subskills,
        }))}
      />
    </PageShell>
  );
}
