import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { currentContentScope } from "@/lib/content-scope";
import { PageHeader, PageShell } from "@/components/sat";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { QuestionEditor } from "../../question-editor-client";
import { getFeatureSetting } from "@/lib/app-settings";
import { academicTopicWhere, buildTaxonomyTree, taxonomyPathLabel } from "@/lib/taxonomy";
import { domainSectionLabel, resolvePracticeArea, tabFromPracticeArea } from "@/lib/practice-area";
import { questionCrumbs } from "@/lib/question-crumbs";
import { questionAnswerCount } from "@/lib/question-usage";

interface PageProps {
  params: Promise<{ questionId: string }>;
}

export default async function EditQuestionPage({ params }: PageProps) {
  const { questionId } = await params;

  const [question, topics, taxonomyNodes, showGraphOption, answeredCount] = await Promise.all([
    prisma.question.findFirst({
      // Only the bank of a program the teacher teaches.
      where: { id: questionId, ...(await currentContentScope()) },
      include: {
        options: { orderBy: { label: "asc" } },
        topic: { select: { domain: { select: { practiceArea: true } } } },
        _count: { select: { fullTestItems: true } },
      },
    }),
    prisma.topic.findMany({
      where: academicTopicWhere,
      include: { taxonomyNode: true, domain: { include: { section: true } }, subskills: true },
      orderBy: { name: "asc" },
    }),
    prisma.taxonomyNode.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] }),
    getFeatureSetting("QUESTION_GRAPH_VISUALIZATION"),
    questionAnswerCount(questionId),
  ]);
  const { byId } = buildTaxonomyTree(taxonomyNodes);

  if (!question) notFound();
  // Back to the Question Bank on this question's area: Tests (a Test question) or its practice area.
  const area = question._count.fullTestItems > 0 ? "tests" : tabFromPracticeArea(resolvePracticeArea(question.topic.domain)) ?? "math";
  const crumbs = questionCrumbs(area);

  return (
    <PageShell>
      <Breadcrumbs items={[...crumbs.items, { label: "Edit question" }]} />
      <PageHeader title="Edit Question" />
      <QuestionEditor
        returnHref={crumbs.questionsHref}
        showGraphOption={showGraphOption}
        answeredCount={answeredCount}
        initial={{
          id: question.id,
          updatedAt: question.updatedAt.toISOString(),
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
          sectionLabel: domainSectionLabel({ practiceArea: t.domain.practiceArea }),
          domainName: t.domain.name,
          taxonomyLabel: taxonomyPathLabel(t.taxonomyNodeId, byId, `${t.domain.section.label} / ${t.domain.name} / ${t.name}`),
          subskills: t.subskills,
        }))}
      />
    </PageShell>
  );
}
